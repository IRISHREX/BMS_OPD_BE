import fs from "fs";
import path from "path";
import QRCode from "qrcode";
import mongoose from "mongoose";
import { catchAsyncErrors } from "../middlewares/catchAsyncErrors.js";
import ErrorHandler from "../middlewares/error.js";
import { Invoice } from "../models/invoiceSchema.js";
import { Appointment } from "../models/appointmentSchema.js";
import { Report } from "../models/reportSchema.js";
import { GeneralSettings } from "../models/generalSettingsSchema.js";
import { syncReportForAppointment } from "./appointmentController.js";
import { User } from "../models/userSchema.js";
import { logEvent } from "../utils/logger.js";

function resolveReceiptImageSrc(imgUri, baseUrl) {
  if (!imgUri) return "";
  if (imgUri.startsWith("data:")) return imgUri;
  if (imgUri.startsWith("http://") || imgUri.startsWith("https://")) return imgUri;

  try {
    const cleanRel = imgUri.replace(/^\/+/, "");
    const possiblePaths = [
      path.resolve(process.cwd(), "..", "BMS-opd-fe", "public", cleanRel),
      path.resolve(process.cwd(), "..", "BMS-opd-fe", "dist", cleanRel),
      path.resolve("/root/BMS-opd-fe", cleanRel),
      path.resolve(process.cwd(), cleanRel),
      path.resolve(process.cwd(), "uploads", cleanRel.replace(/^uploads\//, "")),
      path.resolve("/root/BMS-opd-be", cleanRel),
      path.resolve("/root/BMS-opd-be", "uploads", cleanRel.replace(/^uploads\//, "")),
    ];
    for (const p of possiblePaths) {
      if (fs.existsSync(p) && fs.statSync(p).isFile()) {
        const ext = path.extname(p).toLowerCase().replace(".", "");
        const mime =
          ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg";
        const buf = fs.readFileSync(p);
        return `data:${mime};base64,${buf.toString("base64")}`;
      }
    }
  } catch (err) {
    // Ignore and fallback
  }

  const base = baseUrl || "https://biomechasoft.in";
  return `${base.replace(/\/+$/, "")}/${imgUri.replace(/^\/+/, "")}`;
}

// Create invoice and attach to appointment
export const createInvoice = catchAsyncErrors(async (req, res, next) => {
  const {
    invoiceNumber,
    appointment: appointmentId,
    patient: patientId,
    doctor: doctorId,
    items = [],
    tax = 0,
    discount = 0,
    issuedAt,
    dueDate,
    status,
  } = req.body;

  if (!invoiceNumber || !patientId) {
    return next(new ErrorHandler('invoiceNumber and patient are required', 400));
  }

  // Validate appointment/doctor existence when provided
  let appointment = null;
  if (appointmentId) {
    appointment = await Appointment.findById(appointmentId);
    if (!appointment) return next(new ErrorHandler('Appointment not found', 404));
  }

  if (doctorId) {
    const doctor = await User.findById(doctorId);
    if (!doctor) return next(new ErrorHandler('Doctor not found', 404));
  }

  // Ensure item totals are present
  const normalizedItems = (items || []).map((it) => ({
    description: it.description || it.name || '',
    quantity: Number(it.quantity || 1),
    unitPrice: Number(it.unitPrice || it.price || 0),
    total: Number(it.total != null ? it.total : (Number(it.quantity || 1) * Number(it.unitPrice || it.price || 0))),
  }));

  const subtotal = normalizedItems.reduce((s, i) => s + (Number(i.total) || 0), 0);
  const total = Math.max(0, subtotal + Number(tax || 0) - Number(discount || 0));

  const initialPayments = (status === 'Paid') ? [
    { paidAt: new Date(), amount: total, method: 'Cash', reference: 'Initial Payment' }
  ] : [];

  const invoice = await Invoice.create({
    invoiceNumber,
    appointment: appointmentId,
    patient: patientId,
    doctor: doctorId,
    items: normalizedItems,
    subtotal,
    tax,
    discount,
    total,
    issuedAt: issuedAt || Date.now(),
    dueDate,
    status: status || 'Unpaid',
    notes: req.body.notes || '',
    payments: initialPayments,
  });

  // link invoice to appointment if provided
  if (appointment) {
    appointment.invoices = appointment.invoices || [];
    appointment.invoices.push(invoice._id);
    await appointment.save();
    try {
      await syncReportForAppointment(appointment._id);
    } catch (e) {
      console.warn('Failed to sync report on createInvoice:', e.message);
    }
  }

  logEvent({
    level: "INFO",
    category: "Billing",
    action: "INVOICE_CREATE",
    message: `Bill/Invoice #${invoice.invoiceNumber} created (Amount: ₹${invoice.total})`,
    req,
    metadata: {
      invoiceId: invoice._id,
      invoiceNumber: invoice.invoiceNumber,
      total: invoice.total,
      subtotal: invoice.subtotal,
      patientId,
      appointmentId,
      status: invoice.status,
    },
  });

  return res.status(201).json({ success: true, invoice });
});

// Get single invoice
export const getInvoice = catchAsyncErrors(async (req, res, next) => {
  const { id } = req.params;
  const invoice = await Invoice.findById(id).populate('patient doctor appointment');
  if (!invoice) return next(new ErrorHandler('Invoice not found', 404));
  return res.status(200).json({ success: true, invoice });
});

// List invoices with optional filters (patient, doctor, appointment, status, invoiceNumber, search, dates)
export const listInvoices = catchAsyncErrors(async (req, res, next) => {
  const { patient, doctor, appointment, status, q, start, end, page = 1, limit = 50 } = req.query;
  const query = {};

  if (appointment && mongoose.isValidObjectId(appointment)) {
    query.appointment = new mongoose.Types.ObjectId(appointment);
  }

  if (doctor) {
    if (mongoose.isValidObjectId(doctor)) {
      query.doctor = new mongoose.Types.ObjectId(doctor);
    }
  }

  if (patient) {
    if (mongoose.isValidObjectId(patient)) {
      query.patient = new mongoose.Types.ObjectId(patient);
    } else {
      // Find users matching search string as patient
      const patUsers = await User.find({
        role: 'Patient',
        $or: [
          { firstName: new RegExp(patient, 'i') },
          { lastName: new RegExp(patient, 'i') },
          { name: new RegExp(patient, 'i') },
          { phone: new RegExp(patient, 'i') },
          { nic: new RegExp(patient, 'i') },
        ]
      }).select('_id').lean();
      query.patient = { $in: patUsers.map(u => u._id) };
    }
  }

  if (status && status !== 'all') {
    query.status = status;
  }

  // date range filter on issuedAt
  if (start || end) {
    query.issuedAt = {};
    if (start) {
      const s = new Date(start);
      if (!isNaN(s.getTime())) {
        s.setHours(0, 0, 0, 0);
        query.issuedAt.$gte = s;
      }
    }
    if (end) {
      const e = new Date(end);
      if (!isNaN(e.getTime())) {
        e.setHours(23, 59, 59, 999);
        query.issuedAt.$lte = e;
      }
    }
  }

  if (q && q.trim()) {
    const trimmed = q.trim();
    const regex = new RegExp(trimmed, 'i');
    const orList = [
      { invoiceNumber: regex },
      { notes: regex },
    ];

    if (mongoose.isValidObjectId(trimmed)) {
      const objId = new mongoose.Types.ObjectId(trimmed);
      orList.push({ _id: objId }, { appointment: objId }, { patient: objId }, { doctor: objId });
    }

    // Match patient names/phone
    const matchedPatients = await User.find({
      $or: [
        { firstName: regex },
        { lastName: regex },
        { name: regex },
        { phone: regex },
        { nic: regex },
      ]
    }).select('_id').lean();
    if (matchedPatients.length > 0) {
      orList.push({ patient: { $in: matchedPatients.map(p => p._id) } });
    }

    // Match doctor names
    const matchedDoctors = await User.find({
      role: 'Doctor',
      $or: [
        { firstName: regex },
        { lastName: regex },
        { name: regex },
      ]
    }).select('_id').lean();
    if (matchedDoctors.length > 0) {
      orList.push({ doctor: { $in: matchedDoctors.map(d => d._id) } });
    }

    // Match appointment patient names
    const matchedAppts = await Appointment.find({
      $or: [
        { name: regex },
        { phone: regex },
        { nic: regex },
      ]
    }).select('_id').lean();
    if (matchedAppts.length > 0) {
      orList.push({ appointment: { $in: matchedAppts.map(a => a._id) } });
    }

    query.$or = orList;
  }

  const skip = (Number(page) - 1) * Number(limit);
  const total = await Invoice.countDocuments(query);
  const invoices = await Invoice.find(query)
    .populate('patient doctor appointment')
    .skip(skip)
    .limit(Number(limit))
    .sort({ issuedAt: -1 });

  return res.status(200).json({ success: true, total, page: Number(page), limit: Number(limit), invoices });
});

// Update invoice (partial updates allowed)
export const updateInvoice = catchAsyncErrors(async (req, res, next) => {
  const { id } = req.params;
  const update = { ...req.body };
  // prevent changing invoiceNumber to empty
  if (update.invoiceNumber === '') delete update.invoiceNumber;
  // Load current invoice
  let invoice = await Invoice.findById(id);
  if (!invoice) return next(new ErrorHandler('Invoice not found', 404));

  // If explicit settle request: compute due and append a payment for the remaining amount
  try {
    const currentPaid = (invoice.payments || []).reduce((s, p) => s + (Number(p.amount) || 0), 0);
    const total = Number(invoice.total || 0);
    const dueNow = Math.max(0, total - currentPaid);
    if (req.body && req.body._settle) {
      if (dueNow > 0) {
        invoice.payments = invoice.payments || [];
        invoice.payments.push({ paidAt: new Date(), amount: dueNow, method: 'Cash', reference: 'settlement' });
      }
      // allow other updates in payload as well (but ignore artificial _settle flag)
      delete update._settle;
    }

    // If client explicitly set status to 'Paid' and payments are insufficient, auto-create payment to cover difference
    if (update.status === 'Paid') {
      const paidNow = (invoice.payments || []).reduce((s, p) => s + (Number(p.amount) || 0), 0);
      const remaining = Math.max(0, Number(invoice.total || 0) - paidNow);
      if (remaining > 0) {
        invoice.payments = invoice.payments || [];
        invoice.payments.push({ paidAt: new Date(), amount: remaining, method: 'Manual', reference: 'auto-created-on-status-paid' });
      }
      // keep status = Paid, we'll persist below after recompute
    }

    // Apply any other updates from payload (status will be recomputed but we allow explicit override)
    // Merge allowed fields
    const allowed = ['invoiceNumber','items','tax','discount','dueDate','status','notes','patient','doctor','issuedAt','subtotal','total'];
    allowed.forEach((k) => { if (typeof update[k] !== 'undefined') invoice[k] = update[k]; });

    // Recompute subtotal/total via schema pre-save hook
    await invoice.save();

    // Now normalize status based on payments unless client explicitly provided a status and we choose to respect it
    const paid = (invoice.payments || []).reduce((s, p) => s + (Number(p.amount) || 0), 0);
    const totalNow = Number(invoice.total || 0);
    let newStatus = invoice.status || 'Unpaid';
    if (update.status && typeof update.status === 'string') {
      // respect explicit override, but still ensure 'Paid' corresponds to payments (we may have auto-created payment above)
      newStatus = update.status;
    } else {
      if (paid >= totalNow && totalNow > 0) newStatus = 'Paid';
      else if (paid > 0 && paid < totalNow) newStatus = 'Partial';
      else newStatus = 'Unpaid';
    }
    if (newStatus !== invoice.status) {
      invoice.status = newStatus;
      await invoice.save();
    }

    // Update linked appointment and sync report
    if (invoice.appointment) {
      const appt = await Appointment.findById(invoice.appointment);
      if (appt) {
        // set appointment.paymentStatus based on aggregate of invoices (we keep simple per-invoice behaviour for now)
        const apptPaymentStatus = paid >= totalNow && totalNow > 0 ? 'Paid' : (paid > 0 ? 'Accepted' : 'Due');
        if (appt.paymentStatus !== apptPaymentStatus) {
          appt.paymentStatus = apptPaymentStatus;
          await appt.save();
        }
        try { await syncReportForAppointment(appt._id); } catch (e) { console.warn('Failed to sync report after invoice update', e.message); }
      }
    }

    invoice = await Invoice.findById(id).populate('patient doctor appointment');

    logEvent({
      level: "INFO",
      category: "Billing",
      action: "INVOICE_UPDATE",
      message: `Invoice #${invoice?.invoiceNumber || id} updated (Status: ${invoice?.status}, Total: ₹${invoice?.total})`,
      req,
      metadata: {
        invoiceId: id,
        invoiceNumber: invoice?.invoiceNumber,
        total: invoice?.total,
        status: invoice?.status,
        itemsCount: (invoice?.items || []).length,
      },
    });

    return res.status(200).json({ success: true, invoice });
  } catch (e) {
    console.warn('Failed to update/normalize invoice:', e.message);
    return next(new ErrorHandler('Failed to update invoice', 500));
  }
});

// Delete invoice and remove reference from appointment
export const deleteInvoice = catchAsyncErrors(async (req, res, next) => {
  const { id } = req.params;
  const invoice = await Invoice.findById(id);
  if (!invoice) return next(new ErrorHandler('Invoice not found', 404));

  // remove reference from appointment
  if (invoice.appointment) {
    const appt = await Appointment.findById(invoice.appointment);
    if (appt && Array.isArray(appt.invoices)) {
      appt.invoices = appt.invoices.filter((i) => i.toString() !== invoice._id.toString());
      await appt.save();
    }
  }

  await invoice.deleteOne();

  logEvent({
    level: "WARN",
    category: "Billing",
    action: "INVOICE_DELETE",
    message: `Invoice #${invoice.invoiceNumber} deleted (Amount: ₹${invoice.total})`,
    req,
    metadata: {
      invoiceId: invoice._id,
      invoiceNumber: invoice.invoiceNumber,
      total: invoice.total,
    },
  });

  return res.status(200).json({ success: true, message: 'Invoice deleted' });
});

// Search invoices by invoiceNumber, patient name or phone (joins patient)
export const searchInvoices = catchAsyncErrors(async (req, res, next) => {
  const { q } = req.query;
  if (!q) return next(new ErrorHandler('Search query required', 400));
  const regex = new RegExp(q, 'i');

  // search invoiceNumber directly, and attempt to find patients matching q
  const patientMatches = await User.find({ $or: [{ firstName: regex }, { lastName: regex }, { phone: regex }, { email: regex }] }).select('_id');
  const patientIds = (patientMatches || []).map((p) => p._id);

  const invoices = await Invoice.find({ $or: [{ invoiceNumber: regex }, { patient: { $in: patientIds } }] }).populate('patient doctor appointment');
  return res.status(200).json({ success: true, invoices });
});

// Get invoices by appointment id
export const getInvoicesByAppointment = catchAsyncErrors(async (req, res, next) => {
  const { id } = req.params; // appointment id
  if (!id) return next(new ErrorHandler('Appointment id required', 400));
  let invoices = await Invoice.find({ appointment: id }).populate('patient doctor appointment');
  if (!invoices || invoices.length === 0) {
    const appt = await Appointment.findById(id);
    if (appt) {
      const consultationFee = Number(appt.price || 100);
      const invoiceNumber = `INV-${new Date().toISOString().slice(0,10).replace(/-/g,'')}-${Date.now().toString().slice(-6)}`;
      const normalizedStatus = (appt.paymentStatus === 'Paid' || appt.paymentStatus === 'Accepted' || appt.status === 'Completed') ? 'Paid' : 'Unpaid';
      const items = [{
        description: `Consultation (${appt.department || 'General'})`,
        quantity: 1,
        unitPrice: consultationFee,
        total: consultationFee,
      }];
      const newInvoice = await Invoice.create({
        invoiceNumber,
        appointment: appt._id,
        patient: appt.patientId || undefined,
        doctor: appt.doctorId || undefined,
        items,
        subtotal: consultationFee,
        total: consultationFee,
        status: normalizedStatus,
        issuedAt: appt.appointment_date || new Date(),
        payments: normalizedStatus === 'Paid' ? [{ amount: consultationFee, paidAt: appt.appointment_date || new Date(), method: 'Cash' }] : [],
      });
      appt.invoices = appt.invoices || [];
      appt.invoices.push(newInvoice._id);
      await appt.save();

      try {
        await syncReportForAppointment(appt._id);
      } catch (e) {
        console.warn('Failed to sync report after on-the-fly invoice creation:', e.message);
      }

      invoices = [await Invoice.findById(newInvoice._id).populate('patient doctor appointment')];
    }
  }

  if (!invoices || invoices.length === 0) {
    return next(new ErrorHandler('No invoices found for this appointment', 404));
  }
  return res.status(200).json({ success: true, invoices });
});

// Stats: total earning and total due, optionally grouped by day/week/month within a date range
export const getInvoiceStats = catchAsyncErrors(async (req, res, next) => {
  const { start, end, group, doctor } = req.query;
  // default range: last 30 days
  const endDate = end ? new Date(end) : new Date();
  const startDate = start ? new Date(start) : new Date(new Date(endDate).setDate(endDate.getDate() - 29));

  const query = { issuedAt: { $gte: startDate, $lte: endDate } };
  if (doctor) query.doctor = doctor;

  const invoices = await Invoice.find(query).lean();

  // helper to compute paid amount for an invoice
  const paidAmount = (inv) => (inv.payments || []).reduce((s, p) => s + (Number(p.amount) || 0), 0);

  // overall totals
  let totalEarning = 0;
  let totalDue = 0;

  // grouping map
  const groups = {};

  const getDayKey = (d) => {
    const dt = new Date(d);
    return dt.toISOString().slice(0, 10); // YYYY-MM-DD
  };

  const getMonthKey = (d) => {
    const dt = new Date(d);
    return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`; // YYYY-MM
  };

  const getWeekKey = (d) => {
    const dt = new Date(d);
    // approximate ISO week number
    const target = new Date(dt.valueOf());
    const dayNr = (dt.getDay() + 6) % 7;
    target.setDate(target.getDate() - dayNr + 3);
    const firstThursday = target.valueOf();
    const yearStart = new Date(target.getFullYear(), 0, 4);
    const weekNo = 1 + Math.round((firstThursday - yearStart) / 86400000 / 7);
    return `${target.getFullYear()}-W${String(weekNo).padStart(2, '0')}`;
  };

  (invoices || []).forEach((inv) => {
    const paid = paidAmount(inv);
    const due = Math.max(0, (Number(inv.total) || 0) - paid);
    totalEarning += paid;
    totalDue += due;

    let key = 'overall';
    if (group === 'day') key = getDayKey(inv.issuedAt || inv.createdAt || new Date());
    else if (group === 'week') key = getWeekKey(inv.issuedAt || inv.createdAt || new Date());
    else if (group === 'month') key = getMonthKey(inv.issuedAt || inv.createdAt || new Date());

    if (!groups[key]) groups[key] = { period: key, totalEarning: 0, totalDue: 0, count: 0 };
    groups[key].totalEarning += paid;
    groups[key].totalDue += due;
    groups[key].count += 1;
  });

  const groupArray = Object.values(groups).sort((a, b) => (a.period > b.period ? 1 : -1));

  return res.status(200).json({ success: true, totalEarning, totalDue, groups: groupArray });
});

// Update invoices by appointment id (apply the same partial update to all invoices for the appointment)
export const updateInvoicesByAppointment = catchAsyncErrors(async (req, res, next) => {
  const { id } = req.params; // appointment id
  const payload = { ...req.body };

  if (!id) return next(new ErrorHandler('Appointment id required', 400));

  const invoices = await Invoice.find({ appointment: id });
  if (!invoices || invoices.length === 0) return next(new ErrorHandler('No invoices found for this appointment', 404));

  const updatedInvoices = [];

  for (const inv of invoices) {
    // allow updating items, tax, discount, status, payments
    if (payload.items) inv.items = payload.items.map((it) => ({
      description: it.description || it.name || '',
      quantity: Number(it.quantity || 1),
      unitPrice: Number(it.unitPrice || it.price || 0),
      total: Number(it.total != null ? it.total : (Number(it.quantity || 1) * Number(it.unitPrice || it.price || 0))),
    }));

    if (payload.tax != null) inv.tax = Number(payload.tax);
    if (payload.discount != null) inv.discount = Number(payload.discount);
    if (payload.status) inv.status = payload.status;
    if (payload.dueDate) inv.dueDate = new Date(payload.dueDate);

    // Append any new payments if provided (array)
    if (Array.isArray(payload.payments) && payload.payments.length > 0) {
      inv.payments = inv.payments || [];
      for (const p of payload.payments) {
        inv.payments.push({ paidAt: p.paidAt ? new Date(p.paidAt) : new Date(), amount: Number(p.amount || 0), method: p.method || 'Cash', reference: p.reference });
      }
    }

    // Recompute subtotal and total
    const subtotal = (inv.items || []).reduce((s, it) => s + (Number(it.total) || 0), 0);
    inv.subtotal = subtotal;
    inv.total = Math.max(0, subtotal + (Number(inv.tax) || 0) - (Number(inv.discount) || 0));

    await inv.save();
    // after save, normalize status based on payments
    try {
      const paid = (inv.payments || []).reduce((s, p) => s + (Number(p.amount) || 0), 0);
      let newStatus = inv.status || 'Unpaid';
      if (paid >= Number(inv.total || 0) && Number(inv.total || 0) > 0) newStatus = 'Paid';
      else if (paid > 0 && paid < Number(inv.total || 0)) newStatus = 'Partial';
      else newStatus = 'Unpaid';
      if (newStatus !== inv.status) {
        inv.status = newStatus;
        await inv.save();
      }
      // update linked appointment and sync report
      if (inv.appointment) {
        try {
          const appt = await Appointment.findById(inv.appointment);
          if (appt) {
            const apptPaymentStatus = paid >= Number(inv.total || 0) && Number(inv.total || 0) > 0 ? 'Paid' : 'Due';
            if (appt.paymentStatus !== apptPaymentStatus) {
              appt.paymentStatus = apptPaymentStatus;
              await appt.save();
            }
            await syncReportForAppointment(appt._id);
          }
        } catch (e) {
          console.warn('Failed to update appointment/report after invoice bulk update:', e.message);
        }
      }
    } catch (e) {
      console.warn('Failed to normalize invoice status in bulk update:', e.message);
    }
    updatedInvoices.push(inv);
  }

  return res.status(200).json({ success: true, updatedCount: updatedInvoices.length, invoices: updatedInvoices });
});

// Settle all invoices for an appointment: append payments equal to remaining due for each invoice
export const settleInvoicesForAppointment = catchAsyncErrors(async (req, res, next) => {
  const { id } = req.params; // appointment id
  if (!id) return next(new ErrorHandler('Appointment id required', 400));
  const invoices = await Invoice.find({ appointment: id });
  if (!invoices || invoices.length === 0) return next(new ErrorHandler('No invoices found for this appointment', 404));

  const updated = [];
  for (const inv of invoices) {
    try {
      const paid = (inv.payments || []).reduce((s, p) => s + (Number(p.amount) || 0), 0);
      const total = Number(inv.total || 0);
      const due = Math.max(0, total - paid);
      if (due > 0) {
        inv.payments = inv.payments || [];
        const p = { paidAt: new Date(), amount: due, method: 'Settlement', reference: 'appointment-settlement' };
        // include createdBy if available
        if (req.user && req.user._id) p.createdBy = req.user._id;
        inv.payments.push(p);
      }
      // recompute status and save
      const subtotal = (inv.items || []).reduce((s, it) => s + (Number(it.total) || 0), 0);
      inv.subtotal = subtotal;
      inv.total = Math.max(0, subtotal + (Number(inv.tax) || 0) - (Number(inv.discount) || 0));
      const paidNow = (inv.payments || []).reduce((s, p) => s + (Number(p.amount) || 0), 0);
      if (paidNow >= Number(inv.total || 0) && Number(inv.total || 0) > 0) inv.status = 'Paid';
      else if (paidNow > 0) inv.status = 'Partial';
      else inv.status = 'Unpaid';
      await inv.save();
      updated.push(inv);
    } catch (e) {
      console.warn('Failed to settle invoice', inv._id, e.message);
    }
  }

  // after settling invoices, update appointment paymentStatus to Paid and sync report
  try {
    const appt = await Appointment.findById(id);
    if (appt) {
      appt.paymentStatus = 'Paid';
      await appt.save();
      await syncReportForAppointment(appt._id);
    }
  } catch (e) {
    console.warn('Failed to update appointment/report after settlement', e.message);
  }

  logEvent({
    level: "INFO",
    category: "Billing",
    action: "INVOICE_SETTLE",
    message: `Settled ${updated.length} invoice(s) for appointment #${id}`,
    req,
    metadata: {
      appointmentId: id,
      settledCount: updated.length,
    },
  });

  return res.status(200).json({ success: true, updatedCount: updated.length, invoices: updated });
});

export const downloadInvoice = catchAsyncErrors(async (req, res, next) => {
  const { id } = req.params;
  let invoice = null;
  if (mongoose.Types.ObjectId.isValid(id)) {
    invoice = await Invoice.findById(id).populate('patient doctor appointment');
    if (!invoice) {
      invoice = await Invoice.findOne({ appointment: id }).populate('patient doctor appointment');
    }
  } else {
    invoice = await Invoice.findOne({ invoiceNumber: id }).populate('patient doctor appointment');
  }

  if (!invoice && mongoose.Types.ObjectId.isValid(id)) {
    const appt = await Appointment.findById(id);
    if (appt) {
      const doc = appt.doctor || {};
      invoice = {
        _id: appt._id,
        invoiceNumber: `INV-${String(appt._id).slice(-6).toUpperCase()}`,
        appointment: appt,
        patient: { firstName: appt.name, phone: appt.phone, nic: appt.nic, age: appt.age, gender: appt.gender, email: appt.email },
        doctor: { firstName: doc.firstName || '', lastName: doc.lastName || '', name: `${doc.firstName || ''} ${doc.lastName || ''}`.trim() },
        items: [{ description: `Consultation (${appt.department || 'General'})`, quantity: 1, unitPrice: appt.price || 0, total: appt.price || 0 }],
        subtotal: appt.price || 0,
        tax: 0,
        discount: 0,
        total: appt.price || 0,
        status: appt.paymentStatus === 'Paid' ? 'Paid' : (appt.paymentStatus === 'Refund' ? 'Refund' : 'Unpaid'),
        issuedAt: appt.appointment_date || appt.createdAt,
        payments: appt.paymentStatus === 'Paid' ? [{ amount: appt.price || 0, paidAt: appt.appointment_date, method: 'Cash' }] : []
      };
    }
  }

  if (!invoice && mongoose.Types.ObjectId.isValid(id)) {
    const rep = await Report.findById(id).populate('doctorId patientId');
    if (rep) {
      const appt = rep.appointmentId ? await Appointment.findById(rep.appointmentId) : null;
      const pat = rep.patientId || {};
      const doc = rep.doctorId || (appt ? appt.doctor : {});
      invoice = {
        _id: rep._id,
        invoiceNumber: `INV-${String(rep._id).slice(-6).toUpperCase()}`,
        appointment: appt || {},
        patient: { firstName: pat.firstName || pat.name || (appt ? appt.name : 'Patient'), phone: pat.phone || (appt ? appt.phone : ''), nic: pat.nic, age: appt ? appt.age : undefined, gender: appt ? appt.gender : undefined, email: pat.email },
        doctor: { firstName: doc.firstName || doc.name || '', lastName: doc.lastName || '', name: doc.name || `${doc.firstName || ''} ${doc.lastName || ''}`.trim() },
        items: [{ description: `Medical Consultation / Service`, quantity: 1, unitPrice: rep.amount || 0, total: rep.amount || 0 }],
        subtotal: rep.amount || 0,
        tax: 0,
        discount: 0,
        total: rep.amount || 0,
        status: rep.status || 'Paid',
        issuedAt: rep.appointmentDate || rep.createdAt,
        payments: rep.status === 'Paid' ? [{ amount: rep.paid || rep.amount || 0, paidAt: rep.appointmentDate, method: 'Cash' }] : []
      };
    }
  }

  if (!invoice) return next(new ErrorHandler('Invoice not found', 404));

  const patient = invoice.patient || {};
  const doctor = invoice.doctor || {};
  const appointment = invoice.appointment || {};

  const patientName = (patient.firstName || patient.name) 
    ? `${patient.firstName || ''} ${patient.lastName || ''}`.trim() 
    : (appointment.name || patient.email || patient.phone || 'N/A');

  let docObj = doctor;
  if (!docObj.firstName && !docObj.lastName && appointment.doctor) {
    docObj = appointment.doctor;
  }
  const rawDocName = (docObj.firstName || docObj.lastName) 
    ? `${docObj.firstName || ''} ${docObj.lastName || ''}`.trim() 
    : (docObj.name || 'N/A');
  const doctorName = rawDocName !== 'N/A' && !rawDocName.toLowerCase().startsWith('dr') 
    ? `Dr. ${rawDocName}` 
    : rawDocName;

  const department = appointment.department || docObj.doctorDepartment || 'N/A';
  const issuedAt = invoice.issuedAt 
    ? new Date(invoice.issuedAt).toLocaleString('en-GB', { day: 'numeric', month: 'numeric', year: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric', hour12: true }) 
    : (invoice.createdAt ? new Date(invoice.createdAt).toLocaleString('en-GB', { day: 'numeric', month: 'numeric', year: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric', hour12: true }) : (appointment.appointment_date || '-'));

  const printedByName = (req.user?.firstName || req.user?.lastName)
    ? `${req.user.firstName || ''} ${req.user.lastName || ''}`.trim()
    : (req.user?.name || appointment.book_by_name || 'Admin');
  
  const printedDateTime = new Date().toLocaleString('en-GB', {
    day: 'numeric',
    month: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hour12: true
  });

  // 1. Fetch General Settings
  const generalSettings = (await GeneralSettings.findOne().lean()) || {
    orgName: "BioMechaSoft OPD",
    regNo: "",
    address: "Vill - Tarbagan, Po - Dhuliyan, Dist - Murshidabad, Pin - 742202, State - WB",
    ownerName: "",
    platformFee: 50,
    googleLocationUrl: "",
    defaultHeaderImage: "/Header.jpeg",
    defaultFooterImage: "/Footer.png",
  };

  // 2. Doctor-wise Day-wise serial / token calculation
  let dailySerialNo = 1;
  const apptId = appointment._id || invoice.appointment;
  const apptDocId = appointment.doctorId || (docObj._id);
  const apptRawDate = appointment.appointment_date || invoice.issuedAt || invoice.createdAt || new Date();
  const dateObj = new Date(apptRawDate);
  const dayStr = isNaN(dateObj.getTime()) ? new Date().toISOString().slice(0, 10) : dateObj.toISOString().slice(0, 10);

  if (apptDocId) {
    const startOfDay = new Date(dayStr + 'T00:00:00.000Z');
    const endOfDay = new Date(dayStr + 'T23:59:59.999Z');

    const dayDoctorAppts = await Appointment.find({
      doctorId: apptDocId,
      $or: [
        { appointment_date: { $gte: startOfDay.toISOString(), $lte: endOfDay.toISOString() } },
        { appointment_date: { $regex: `^${dayStr}` } },
        { createdAt: { $gte: startOfDay, $lte: endOfDay } }
      ]
    }).sort({ createdAt: 1, appointment_date: 1 }).select('_id').lean();

    if (dayDoctorAppts && dayDoctorAppts.length > 0) {
      const idx = dayDoctorAppts.findIndex(a => String(a._id) === String(apptId));
      if (idx >= 0) {
        dailySerialNo = idx + 1;
      } else {
        dailySerialNo = dayDoctorAppts.length + 1;
      }
    }
  }

  const paddedSerial = String(dailySerialNo).padStart(2, '0');
  const dayFormatted = dayStr.replace(/-/g, '');
  const docInitials = ((docObj.firstName ? docObj.firstName.charAt(0) : 'D') + (docObj.lastName ? docObj.lastName.charAt(0) : 'R')).toUpperCase();
  const doctorDayWiseReceiptNumber = `REC-${dayFormatted}-${docInitials}-${paddedSerial}`;

  // 3. Generate QR Code
  let qrCodeDataUrl = '';
  if (generalSettings.googleLocationUrl) {
    try {
      qrCodeDataUrl = await QRCode.toDataURL(generalSettings.googleLocationUrl, {
        width: 140,
        margin: 1,
        color: { dark: '#0f172a', light: '#ffffff' }
      });
    } catch (e) {
      console.error('QR code generation error:', e);
    }
  }

  // 4. Resolve Header and Footer images
  const headerSrc = resolveReceiptImageSrc(generalSettings.defaultHeaderImage || '/Header.jpeg');
  const footerSrc = resolveReceiptImageSrc(generalSettings.defaultFooterImage || '/Footer.png');

  // 5. Fee breakdown
  const hasPlatformItem = (invoice.items || []).some(it => (it.description || '').toLowerCase().includes('platform'));
  const rawTotal = Number(invoice.total || appointment.price || 0);
  const platformFee = hasPlatformItem ? 0 : Number(generalSettings.platformFee !== undefined ? generalSettings.platformFee : 50);
  const grandTotal = rawTotal + platformFee;

  const html = `<!doctype html>
  <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width,initial-scale=1">
      <title>Receipt ${escapeHtml(doctorDayWiseReceiptNumber)}</title>
      <style>
        * { box-sizing: border-box; }
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
          padding: 16px;
          color: #1e293b;
          max-width: 680px;
          margin: 0 auto;
          line-height: 1.45;
          background: #f8fafc;
        }
        .receipt-card {
          border: 1px solid #cbd5e1;
          border-radius: 12px;
          background: #ffffff;
          overflow: hidden;
          box-shadow: 0 4px 14px rgba(0,0,0,0.06);
        }
        .header-image-container {
          width: 100%;
          background: #ffffff;
          border-bottom: 2px solid #e2e8f0;
          text-align: center;
        }
        .header-image-container img {
          width: 100%;
          max-height: 140px;
          object-fit: contain;
          display: block;
        }
        .receipt-body {
          padding: 20px 24px;
        }
        .clinic-info {
          text-align: center;
          padding-bottom: 14px;
          border-bottom: 1px solid #e2e8f0;
          margin-bottom: 16px;
        }
        .clinic-name {
          font-size: 20px;
          font-weight: 800;
          color: #0f172a;
          margin: 0;
          letter-spacing: -0.3px;
        }
        .clinic-meta {
          font-size: 12px;
          color: #64748b;
          margin-top: 4px;
          line-height: 1.4;
        }
        .clinic-meta span {
          margin: 0 4px;
        }
        .token-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
          border: 1.5px solid #bfdbfe;
          border-radius: 10px;
          padding: 12px 18px;
          margin-bottom: 18px;
        }
        .token-left {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .token-badge {
          background: #2563eb;
          color: #ffffff;
          border-radius: 8px;
          padding: 6px 14px;
          font-size: 24px;
          font-weight: 900;
          letter-spacing: 0.5px;
          display: inline-block;
          box-shadow: 0 2px 6px rgba(37,99,235,0.3);
        }
        .token-title {
          font-size: 11px;
          font-weight: 800;
          color: #1e40af;
          text-transform: uppercase;
          letter-spacing: 0.8px;
        }
        .token-subtitle {
          font-size: 12px;
          color: #3b82f6;
          font-weight: 600;
        }
        .token-right {
          text-align: right;
          font-size: 12px;
        }
        .token-right .receipt-num {
          font-size: 14px;
          font-weight: 800;
          color: #0f172a;
        }
        .token-right .inv-ref {
          font-size: 11px;
          color: #64748b;
          margin-top: 2px;
        }
        .details-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px 18px;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          padding: 14px 16px;
          margin-bottom: 18px;
          font-size: 13px;
        }
        .detail-item strong {
          color: #64748b;
          display: block;
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-bottom: 2px;
        }
        .detail-item span {
          color: #0f172a;
          font-weight: 600;
        }
        .badge {
          display: inline-block;
          padding: 3px 8px;
          border-radius: 12px;
          font-size: 11px;
          font-weight: 700;
          background: #dcfce7;
          color: #15803d;
        }
        .badge-unpaid {
          background: #fef3c7;
          color: #b45309;
        }
        .table-section {
          margin-bottom: 16px;
        }
        .table-section h3 {
          margin: 0 0 8px 0;
          color: #0f172a;
          font-size: 14px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          font-size: 13px;
        }
        th {
          background: #f1f5f9;
          padding: 8px 12px;
          text-align: left;
          border-bottom: 2px solid #cbd5e1;
          color: #475569;
          font-weight: 700;
          font-size: 12px;
        }
        td {
          padding: 8px 12px;
          border-bottom: 1px solid #e2e8f0;
          color: #334155;
        }
        .totals {
          margin-top: 14px;
          border-top: 2px dashed #cbd5e1;
          padding-top: 10px;
          text-align: right;
        }
        .grand-total {
          font-size: 18px;
          font-weight: 900;
          color: #1e3a8a;
        }
        .qr-section {
          display: flex;
          align-items: center;
          gap: 14px;
          background: #f8fafc;
          border: 1.5px dashed #94a3b8;
          border-radius: 8px;
          padding: 10px 14px;
          margin-top: 16px;
        }
        .qr-section img {
          width: 72px;
          height: 72px;
          border-radius: 6px;
          border: 1px solid #cbd5e1;
          background: #ffffff;
        }
        .qr-text strong {
          display: block;
          font-size: 13px;
          color: #0f172a;
        }
        .qr-text span {
          font-size: 11px;
          color: #64748b;
          display: block;
          margin-top: 2px;
        }
        .footer-image-container {
          width: 100%;
          background: #ffffff;
          border-top: 2px solid #e2e8f0;
          text-align: center;
        }
        .footer-image-container img {
          width: 100%;
          max-height: 85px;
          object-fit: contain;
          display: block;
        }
        .footer-print-info {
          padding: 10px 24px;
          font-size: 11px;
          color: #64748b;
          text-align: right;
          background: #f8fafc;
          border-top: 1px solid #e2e8f0;
        }
        @media print {
          body { background: #fff; padding: 0; }
          .receipt-card { border: none; box-shadow: none; }
        }
      </style>
    </head>
    <body>
      <div class="receipt-card">
        ${headerSrc ? `
        <div class="header-image-container">
          <img src="${headerSrc}" alt="Clinic Header" />
        </div>
        ` : ''}

        <div class="receipt-body">
          <div class="clinic-info">
            <h1 class="clinic-name">${escapeHtml(generalSettings.orgName || 'BioMechaSoft OPD')}</h1>
            <div class="clinic-meta">
              ${generalSettings.regNo ? `<span><strong>Reg No:</strong> ${escapeHtml(generalSettings.regNo)}</span> •` : ''}
              ${generalSettings.ownerName ? `<span><strong>Director:</strong> ${escapeHtml(generalSettings.ownerName)}</span> •` : ''}
              <span>${escapeHtml(generalSettings.address || '')}</span>
            </div>
          </div>

          <div class="token-row">
            <div class="token-left">
              <div class="token-badge">#${paddedSerial}</div>
              <div>
                <div class="token-title">Daily Token / Serial No</div>
                <div class="token-subtitle">${escapeHtml(doctorName)} • ${escapeHtml(dayStr)}</div>
              </div>
            </div>
            <div class="token-right">
              <div class="receipt-num">${escapeHtml(doctorDayWiseReceiptNumber)}</div>
              <div class="inv-ref">Ref: ${escapeHtml(invoice.invoiceNumber || invoice._id || '')}</div>
            </div>
          </div>

          <div class="details-grid">
            <div class="detail-item">
              <strong>Patient Name</strong>
              <span>${escapeHtml(patientName)}</span>
            </div>
            <div class="detail-item">
              <strong>Doctor Name</strong>
              <span>${escapeHtml(doctorName)}</span>
            </div>
            <div class="detail-item">
              <strong>Department</strong>
              <span>${escapeHtml(department)}</span>
            </div>
            <div class="detail-item">
              <strong>Date & Time</strong>
              <span>${escapeHtml(issuedAt)}</span>
            </div>
            <div class="detail-item">
              <strong>Phone / Contact</strong>
              <span>${escapeHtml(patient.phone || appointment.phone || 'N/A')}</span>
            </div>
            <div class="detail-item">
              <strong>Payment Status</strong>
              <span class="badge ${invoice.status === 'Paid' || appointment.paymentStatus === 'Paid' ? '' : 'badge-unpaid'}">
                ${escapeHtml(invoice.status || appointment.paymentStatus || 'Unpaid')}
              </span>
            </div>
          </div>

          <div class="table-section">
            <h3>Fee Details</h3>
            <table>
              <thead>
                <tr>
                  <th>Description</th>
                  <th style="text-align:center">Qty</th>
                  <th style="text-align:right">Price</th>
                  <th style="text-align:right">Total</th>
                </tr>
              </thead>
              <tbody>
                ${(invoice.items && invoice.items.length > 0) ? invoice.items.map(i => `
                  <tr>
                    <td>${escapeHtml(i.description || 'Consultation Fee')}</td>
                    <td style="text-align:center">${escapeHtml(String(i.quantity || 1))}</td>
                    <td style="text-align:right">₹${escapeHtml(String(i.unitPrice || invoice.total || 0))}</td>
                    <td style="text-align:right">₹${escapeHtml(String(i.total || invoice.total || 0))}</td>
                  </tr>
                `).join('') : `
                  <tr>
                    <td>Consultation Fee</td>
                    <td style="text-align:center">1</td>
                    <td style="text-align:right">₹${escapeHtml(String(rawTotal))}</td>
                    <td style="text-align:right">₹${escapeHtml(String(rawTotal))}</td>
                  </tr>
                `}
                ${platformFee > 0 ? `
                  <tr>
                    <td>Registration / Platform Fee</td>
                    <td style="text-align:center">1</td>
                    <td style="text-align:right">₹${escapeHtml(String(platformFee))}</td>
                    <td style="text-align:right">₹${escapeHtml(String(platformFee))}</td>
                  </tr>
                ` : ''}
              </tbody>
            </table>
          </div>

          <div class="totals">
            <div class="grand-total">Total Payable: ₹${escapeHtml(String(grandTotal))}</div>
          </div>

          ${qrCodeDataUrl ? `
          <div class="qr-section">
            <img src="${qrCodeDataUrl}" alt="Google Location QR Code" />
            <div class="qr-text">
              <strong>Scan for Clinic Location & Navigation</strong>
              <span>Scan with your phone camera to open Google Maps navigation directly to the clinic.</span>
            </div>
          </div>
          ` : ''}
        </div>

        ${footerSrc ? `
        <div class="footer-image-container">
          <img src="${footerSrc}" alt="Clinic Footer" />
        </div>
        ` : ''}

        <div class="footer-print-info">
          Printed By: <strong>${escapeHtml(printedByName)}</strong> (${escapeHtml(printedDateTime)})
        </div>
      </div>
    </body>
  </html>`;

  logEvent({
    level: "INFO",
    category: "Billing",
    action: "INVOICE_DOWNLOAD",
    message: `Receipt/Invoice #${invoice.invoiceNumber || invoice._id} viewed/downloaded for ${patientName}`,
    req,
    metadata: {
      invoiceId: invoice._id,
      invoiceNumber: invoice.invoiceNumber,
      patient: patientName,
      doctor: doctorName,
    },
  });

  res.setHeader('Content-Type', 'text/html');
  res.setHeader('Content-Disposition', `inline; filename="receipt-${invoice._id}.html"`);
  return res.status(200).send(html);
});

// Simple HTML escape helper
function escapeHtml(str) {
  if (str == null) return '';
  return String(str).replace(/[&<>"'`]/g, (s) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
    '`': '&#96;'
  }[s]));
}
// Get invoices by doctor or patient email
export const getInvoicesByEmail = catchAsyncErrors(async (req, res, next) => {
  const { email, role } = req.query;
  if (!email || !role) return next(new ErrorHandler('Email and role are required', 400));
  let user;
  if (role === 'Doctor') {
    user = await User.findOne({ email: email.toLowerCase(), role: 'Doctor' });
    if (!user) return next(new ErrorHandler('Doctor not found', 404));
    const invoices = await Invoice.find({ doctor: user._id }).populate('patient doctor appointment');
    return res.status(200).json({ success: true, invoices });
  } else if (role === 'Patient') {
    user = await User.findOne({ email: email.toLowerCase(), role: 'Patient' });
    if (!user) return next(new ErrorHandler('Patient not found', 404));
    const invoices = await Invoice.find({ patient: user._id }).populate('patient doctor appointment');
    return res.status(200).json({ success: true, invoices });
  } else {
    return next(new ErrorHandler('Role must be Doctor or Patient', 400));
  }
});
