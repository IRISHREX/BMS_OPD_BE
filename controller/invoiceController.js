import { catchAsyncErrors } from "../middlewares/catchAsyncErrors.js";
import ErrorHandler from "../middlewares/error.js";
import { Invoice } from "../models/invoiceSchema.js";
import { Appointment } from "../models/appointmentSchema.js";
import { syncReportForAppointment } from "./appointmentController.js";
import { User } from "../models/userSchema.js";

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
  });

  // link invoice to appointment if provided
  if (appointment) {
    appointment.invoices = appointment.invoices || [];
    appointment.invoices.push(invoice._id);
    await appointment.save();
  }

  res.status(201).json({ success: true, invoice });
});

// Get single invoice
export const getInvoice = catchAsyncErrors(async (req, res, next) => {
  const { id } = req.params;
  const invoice = await Invoice.findById(id).populate('patient doctor appointment');
  if (!invoice) return next(new ErrorHandler('Invoice not found', 404));
  res.status(200).json({ success: true, invoice });
});

// List invoices with optional filters (patient, doctor, appointment, status, invoiceNumber)
export const listInvoices = catchAsyncErrors(async (req, res, next) => {
  const { patient, doctor, appointment, status, q, start, end, page = 1, limit = 50 } = req.query;
  const query = {};
  if (patient) query.patient = patient;
  if (doctor) query.doctor = doctor;
  if (appointment) query.appointment = appointment;
  if (status) query.status = status;
  if (q) {
    const regex = new RegExp(q, 'i');
    query.$or = [{ invoiceNumber: regex }];
  }

  // date range filter on issuedAt
  if (start || end) {
    query.issuedAt = {};
    if (start) query.issuedAt.$gte = new Date(start);
    if (end) query.issuedAt.$lte = new Date(end);
  }

  const skip = (Number(page) - 1) * Number(limit);
  const invoices = await Invoice.find(query).populate('patient doctor appointment').skip(skip).limit(Number(limit)).sort({ issuedAt: -1 });
  res.status(200).json({ success: true, invoices });
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
    res.status(200).json({ success: true, invoice });
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
  res.status(200).json({ success: true, message: 'Invoice deleted' });
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
  res.status(200).json({ success: true, invoices });
});

// Get invoices by appointment id
export const getInvoicesByAppointment = catchAsyncErrors(async (req, res, next) => {
  const { id } = req.params; // appointment id
  if (!id) return next(new ErrorHandler('Appointment id required', 400));
  const invoices = await Invoice.find({ appointment: id }).populate('patient doctor appointment');
  if (!invoices || invoices.length === 0) {
    return next(new ErrorHandler('No invoices found for this appointment', 404));
  }
  res.status(200).json({ success: true, invoices });
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

  res.status(200).json({ success: true, totalEarning, totalDue, groups: groupArray });
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

  res.status(200).json({ success: true, updatedCount: updatedInvoices.length, invoices: updatedInvoices });
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

  res.status(200).json({ success: true, updatedCount: updated.length, invoices: updated });
});

// Download invoice as HTML attachment (populated fields, safe fallback values)
export const downloadInvoice = catchAsyncErrors(async (req, res, next) => {
  const { id } = req.params;
  const invoice = await Invoice.findById(id).populate('patient doctor appointment');
  if (!invoice) return next(new ErrorHandler('Invoice not found', 404));

  const patient = invoice.patient || {};
  const doctor = invoice.doctor || {};
  const appointment = invoice.appointment || {};

  const patientName = (patient.firstName || patient.name) ? `${patient.firstName || ''} ${patient.lastName || ''}`.trim() : (patient.email || patient.phone || 'N/A');
  const doctorName = (doctor.firstName || doctor.lastName) ? `${doctor.firstName || ''} ${doctor.lastName || ''}`.trim() : (doctor.email || doctor.phone || 'N/A');
  const issuedAt = invoice.issuedAt ? new Date(invoice.issuedAt).toLocaleString() : (invoice.createdAt ? new Date(invoice.createdAt).toLocaleString() : (appointment.appointment_date || '-'));

  const itemsHtml = (invoice.items || []).map(i => `<li>${escapeHtml(i.description || '')} - ${escapeHtml(String(i.quantity))} x ${escapeHtml(String(i.unitPrice))} = ${escapeHtml(String(i.total))}</li>`).join('');

  const html = `<!doctype html>
  <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width,initial-scale=1">
      <title>Invoice ${escapeHtml(invoice.invoiceNumber || '')}</title>
      <style>body{font-family:Arial,Helvetica,sans-serif;padding:20px}h1{margin-bottom:0}p{margin:4px 0}ul{padding-left:20px}</style>
    </head>
    <body>
      <h1>Invoice ${escapeHtml(invoice.invoiceNumber || '')}</h1>
      <p><strong>Patient:</strong> ${escapeHtml(patientName || 'N/A')}</p>
      <p><strong>Email/Phone:</strong> ${escapeHtml(patient.email || patient.phone || 'N/A')}</p>
      <p><strong>Doctor:</strong> ${escapeHtml(doctorName)}</p>
      <p><strong>Date:</strong> ${escapeHtml(issuedAt || '-')}</p>
      <h3>Items:</h3>
      <ul>${itemsHtml}</ul>
      <p><strong>Subtotal:</strong> ${escapeHtml(String(invoice.subtotal || 0))}</p>
      <p><strong>Tax:</strong> ${escapeHtml(String(invoice.tax || 0))}</p>
      <p><strong>Discount:</strong> ${escapeHtml(String(invoice.discount || 0))}</p>
      <p><strong>Total:</strong> ${escapeHtml(String(invoice.total || 0))}</p>
      <p><strong>Payment Status:</strong> ${escapeHtml(invoice.status || 'N/A')}</p>
    </body>
  </html>`;

  res.setHeader('Content-Type', 'text/html');
  res.setHeader('Content-Disposition', `attachment; filename="invoice-${invoice._id}.html"`);
  res.status(200).send(html);
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
