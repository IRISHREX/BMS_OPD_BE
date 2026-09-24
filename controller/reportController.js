import { catchAsyncErrors } from "../middlewares/catchAsyncErrors.js";
import ErrorHandler from "../middlewares/error.js";
import mongoose from "mongoose";
import { Invoice } from "../models/invoiceSchema.js";
import { Appointment } from "../models/appointmentSchema.js";
import { Report } from "../models/reportSchema.js";
import { logEvent } from "../utils/logger.js";

// Helper to parse ISO date (day start / day end)
const parseRange = (start, end) => {
  let s = start ? new Date(start) : null;
  let e = end ? new Date(end) : null;
  if (s && isNaN(s.getTime())) s = null;
  if (e && isNaN(e.getTime())) e = null;
  if (s) s.setHours(0, 0, 0, 0);
  if (e) {
    e.setHours(23, 59, 59, 999);
  } else if (s) {
    // if only start provided, set end to same day end
    e = new Date(s);
    e.setHours(23, 59, 59, 999);
  }
  return { s, e };
};

export const getReportSummary = catchAsyncErrors(async (req, res, next) => {
  const { start, end, doctorId, groupBy = "day", source = "hybrid" } = req.query;
  const { s, e } = parseRange(start, end);

  // build match for invoices
  const invMatch = {};
  if (s || e) invMatch.issuedAt = {};
  if (s) invMatch.issuedAt.$gte = s;
  if (e) invMatch.issuedAt.$lte = e;
  if (doctorId && mongoose.isValidObjectId(doctorId)) {
    invMatch.doctor = new mongoose.Types.ObjectId(doctorId);
  }

  // Aggregation on invoices: compute paid (sum payments) and unpaid (total - sum payments)
  const invPipeline = [
    { $match: invMatch },
    // compute paidAmount robustly using $reduce over payments array
    {
      $addFields: {
        paidAmount: {
          $reduce: {
            input: { $ifNull: ["$payments", []] },
            initialValue: 0,
            in: { $add: ["$$value", { $ifNull: ["$$this.amount", 0] }] },
          },
        },
      },
    },
    {
      $project: {
        day: { $dateToString: { format: groupBy === "month" ? "%Y-%m" : "%Y-%m-%d", date: "$issuedAt" } },
        paidAmount: 1,
        unpaidAmount: { $subtract: ["$total", { $ifNull: ["$paidAmount", 0] }] },
      },
    },
    {
      $group: {
        _id: "$day",
        revenue: { $sum: "$paidAmount" },
        due: { $sum: "$unpaidAmount" },
        invoices: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ];

  const invResults = await Invoice.aggregate(invPipeline).allowDiskUse(true);

  // convert to a map by period
  const byPeriod = new Map();
  let totalRevenue = 0;
  let totalDue = 0;
  invResults.forEach((r) => {
    const period = r._id;
    byPeriod.set(period, { period, revenue: r.revenue || 0, due: r.due || 0, invoices: r.invoices || 0, appointments: 0 });
    totalRevenue += r.revenue || 0;
    totalDue += r.due || 0;
  });

  // If hybrid or appointment-only, include appointments without invoices
  if (source === "hybrid" || source === "appointment") {
    const apptMatch = {};
    if (s || e) apptMatch.appointment_date = {};
    if (s) apptMatch.appointment_date.$gte = s.toISOString();
    if (e) apptMatch.appointment_date.$lte = e.toISOString();
    if (doctorId && mongoose.isValidObjectId(doctorId)) {
      apptMatch.doctorId = new mongoose.Types.ObjectId(doctorId);
    }
    // only those without invoices
    apptMatch.$or = [{ invoices: { $exists: false } }, { invoices: { $size: 0 } }];

    const appts = await Appointment.find(apptMatch).select("appointment_date price paymentStatus doctorId patientId");
    appts.forEach((a) => {
      const d = new Date(a.appointment_date);
      const period = groupBy === "month" ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const entry = byPeriod.get(period) || { period, revenue: 0, due: 0, invoices: 0, appointments: 0 };
      const price = Number(a.price || 0) || 0;
        // Count appointment price as revenue when the appointment is Completed
        // or explicitly marked Paid. Otherwise treat as due/receivable.
        if (a.status === 'Completed') {
          entry.revenue += price;
          totalRevenue += price;
        } else if (String(a.paymentStatus || '').trim() === 'Paid') {
          entry.revenue += price;
          totalRevenue += price;
        } else {
          entry.due += price;
          totalDue += price;
        }
      entry.appointments = (entry.appointments || 0) + 1;
      byPeriod.set(period, entry);
    });
  }

  // convert map to sorted array
  const periods = Array.from(byPeriod.values()).sort((x, y) => x.period.localeCompare(y.period));

  return res.status(200).json({ success: true, totals: { revenue: totalRevenue, due: totalDue }, byPeriod: periods });
});

// List / search persisted report entries
export const listReports = catchAsyncErrors(async (req, res, next) => {
  const { start, end, appointmentId, q, doctorId, status, page = 1, limit = 50 } = req.query;
  const filter = {};
  if (appointmentId) filter.appointmentId = appointmentId;
  if (doctorId && mongoose.isValidObjectId(doctorId)) filter.doctorId = new mongoose.Types.ObjectId(doctorId);
  if (status) {
    if (status === 'Refund') {
      filter.status = 'Refund';
      try {
        const refundedAppts = await Appointment.find({ paymentStatus: 'Refund' }).select('_id').lean();
        for (const ra of refundedAppts) {
          const rep = await Report.findOne({ appointmentId: ra._id });
          if (!rep || rep.status !== 'Refund') {
            await upsertReportEntryForAppointment(ra._id);
          }
        }
      } catch (e) {
        console.warn('Auto-sync refunded reports error:', e.message);
      }
    } else {
      filter.status = status;
    }
  }
  if (start || end) {
    filter.appointmentDate = {};
    if (start) {
      const s = new Date(start);
      if (!isNaN(s.getTime())) {
        s.setHours(0, 0, 0, 0);
        filter.appointmentDate.$gte = s;
      }
    }
    if (end) {
      const e = new Date(end);
      if (!isNaN(e.getTime())) {
        e.setHours(23, 59, 59, 999);
        filter.appointmentDate.$lte = e;
      }
    }
  }

  if (q && q.trim()) {
    const trimmed = q.trim();
    const regex = new RegExp(trimmed, 'i');
    const orConditions = [{ notes: regex }];

    if (mongoose.Types.ObjectId.isValid(trimmed)) {
      const objId = new mongoose.Types.ObjectId(trimmed);
      orConditions.push(
        { _id: objId },
        { appointmentId: objId },
        { patientId: objId },
        { doctorId: objId }
      );
    }

    // 1. Search patient user records
    const matchingPatients = await mongoose.model('User').find({
      $or: [
        { firstName: regex },
        { lastName: regex },
        { name: regex },
        { phone: regex },
        { email: regex },
        { nic: regex },
      ],
    }).select('_id').lean();
    if (matchingPatients.length > 0) {
      orConditions.push({ patientId: { $in: matchingPatients.map((p) => p._id) } });
    }

    // 2. Search doctor user records
    const matchingDoctors = await mongoose.model('User').find({
      role: 'Doctor',
      $or: [
        { firstName: regex },
        { lastName: regex },
        { name: regex },
        { doctorDepartment: regex },
      ],
    }).select('_id').lean();
    if (matchingDoctors.length > 0) {
      orConditions.push({ doctorId: { $in: matchingDoctors.map((d) => d._id) } });
    }

    // 3. Search appointments by patient name, phone, doctor name, nic
    const matchingAppointments = await Appointment.find({
      $or: [
        { name: regex },
        { phone: regex },
        { nic: regex },
        { 'doctor.firstName': regex },
        { 'doctor.lastName': regex },
      ],
    }).select('_id').lean();
    if (matchingAppointments.length > 0) {
      orConditions.push({ appointmentId: { $in: matchingAppointments.map((a) => a._id) } });
    }

    // 3b. Search by appointment ID short-code or hex suffix (e.g. "APT-622C18" or "622C18")
    const cleanHex = trimmed.replace(/^APT-?/i, '').replace(/^P-?/i, '').replace(/^INV-?/i, '').trim();
    if (cleanHex.length >= 2 && /^[0-9a-fA-F]+$/.test(cleanHex)) {
      try {
        const hexRegex = new RegExp(`${cleanHex}$`, 'i');
        const hexSubRegex = new RegExp(cleanHex, 'i');
        const matchingHexAppts = await Appointment.find({
          $expr: {
            $regexMatch: {
              input: { $toString: "$_id" },
              regex: cleanHex,
              options: "i",
            },
          },
        }).select('_id').lean();
        if (matchingHexAppts.length > 0) {
          orConditions.push({ appointmentId: { $in: matchingHexAppts.map((a) => a._id) } });
        }

        const matchingHexReports = await Report.find({
          $expr: {
            $regexMatch: {
              input: { $toString: "$_id" },
              regex: cleanHex,
              options: "i",
            },
          },
        }).select('_id').lean();
        if (matchingHexReports.length > 0) {
          orConditions.push({ _id: { $in: matchingHexReports.map((r) => r._id) } });
        }
      } catch (err) {
        // ignore regex error on invalid hex patterns
      }
    }

    // 4. Search Invoices by invoiceNumber
    const matchingInvoices = await Invoice.find({
      invoiceNumber: regex,
    }).select('appointment').lean();
    const invoiceApptIds = matchingInvoices.map((inv) => inv.appointment).filter(Boolean);
    if (invoiceApptIds.length > 0) {
      orConditions.push({ appointmentId: { $in: invoiceApptIds } });
    }

    filter.$or = orConditions;
  }

  const skip = (Number(page) - 1) * Number(limit);
  const total = await Report.countDocuments(filter);
  const entries = await Report.find(filter)
    .sort({ appointmentDate: -1 })
    .skip(skip)
    .limit(Number(limit))
    .populate('doctorId', 'firstName lastName doctorDepartment name')
    .populate('patientId', 'firstName lastName name phone email nic')
    .populate({
      path: 'appointmentId',
      select: 'name phone doctor department appointment_date price paymentStatus status invoices nic',
      populate: { path: 'invoices', select: 'invoiceNumber total status payments' }
    })
    .lean();

  return res.status(200).json({ success: true, total, page: Number(page), limit: Number(limit), entries });
});

// Create or update a report entry (admin)
export const upsertReport = catchAsyncErrors(async (req, res, next) => {
  const payload = req.body;
  if (!payload.appointmentId) return next(new ErrorHandler('appointmentId required', 400));
  const existing = await Report.findOne({ appointmentId: payload.appointmentId });
  if (existing) {
    Object.assign(existing, payload);
    await existing.save();

    logEvent({
      level: "INFO",
      category: "Report",
      action: "REPORT_UPDATE",
      message: `Report updated for appointment #${payload.appointmentId}`,
      req,
      metadata: { appointmentId: payload.appointmentId, status: existing.status, amount: existing.amount },
    });

    return res.status(200).json({ success: true, report: existing });
  }
  const created = await Report.create(payload);

  logEvent({
    level: "INFO",
    category: "Report",
    action: "REPORT_CREATE",
    message: `Report created for appointment #${payload.appointmentId}`,
    req,
    metadata: { appointmentId: payload.appointmentId, status: created.status, amount: created.amount },
  });

  return res.status(201).json({ success: true, report: created });
});

// Update specific report entry (partial updates allowed)
export const updateReport = catchAsyncErrors(async (req, res, next) => {
  const { id } = req.params;
  const payload = req.body;
  const entry = await Report.findById(id);
  if (!entry) return next(new ErrorHandler('Report entry not found', 404));
  Object.assign(entry, payload);
  await entry.save();

  logEvent({
    level: "INFO",
    category: "Report",
    action: "REPORT_UPDATE",
    message: `Report entry #${id} updated`,
    req,
    metadata: { reportId: id, appointmentId: entry.appointmentId, amount: entry.amount, status: entry.status },
  });

  return res.status(200).json({ success: true, report: entry });
});

  // Get reports by doctor or patient email
  export const getReportsByEmail = catchAsyncErrors(async (req, res, next) => {
    const { email, role } = req.query;
    if (!email || !role) return next(new ErrorHandler('Email and role are required', 400));
    let user;
    if (role === 'Doctor') {
      user = await mongoose.model('User').findOne({ email: email.toLowerCase(), role: 'Doctor' });
      if (!user) return next(new ErrorHandler('Doctor not found', 404));
      const reports = await Report.find({ doctorId: user._id }).populate('doctorId patientId');
      return res.status(200).json({ success: true, reports });
    } else if (role === 'Patient') {
      user = await mongoose.model('User').findOne({ email: email.toLowerCase(), role: 'Patient' });
      if (!user) return next(new ErrorHandler('Patient not found', 404));
      const reports = await Report.find({ patientId: user._id }).populate('doctorId patientId');
      return res.status(200).json({ success: true, reports });
    } else {
      return next(new ErrorHandler('Role must be Doctor or Patient', 400));
    }
  });

// Delete report entry
export const deleteReport = catchAsyncErrors(async (req, res, next) => {
  const { id } = req.params;
  const entry = await Report.findById(id);
  if (!entry) return next(new ErrorHandler('Report entry not found', 404));
  await entry.deleteOne();

  logEvent({
    level: "WARN",
    category: "Report",
    action: "REPORT_DELETE",
    message: `Report entry #${id} was deleted`,
    req,
    metadata: { reportId: id, appointmentId: entry.appointmentId },
  });

  return res.status(200).json({ success: true, message: 'Report entry deleted' });
});

// Helper used by appointment flow to create/adjust report entry
export async function upsertReportEntryForAppointment(apptId) {
  if (!apptId) return null;
  const appt = await Appointment.findById(apptId).populate('doctorId').populate('patientId');
  if (!appt) return null;
  // Determine amount to consider: prefer invoice total if invoices exist and are non-empty
  let amount = Number(appt.price || 0);
  if (appt.invoices && appt.invoices.length > 0) {
    // try to fetch invoice totals (take first invoice total as canonical for this appointment)
    try {
      const inv = await Invoice.findOne({ _id: appt.invoices[0] });
      if (inv) amount = Number(inv.total || inv.subtotal || amount);
    } catch (e) {
      // ignore and fallback to appointment.price
    }
  }

  // paid/due logic (rules):
  // - If appointment.status === 'Completed' => treat as Paid
  // - Else if appointment.status === 'Accepted' => treat as Due (recorded/acknowledged but outstanding)
  // - Else if paymentStatus === 'Paid' => treat as Paid
  // - Otherwise treat as Due
  let paid = 0;
  let due = 0;
  const ps = String(appt.paymentStatus || '').trim();
  const st = String(appt.status || '').trim();
  if (ps === 'Refund' || st === 'Canceled' || st === 'Cancelled' || st === 'Rejected') {
    paid = 0;
    due = 0;
  } else if (appt.status === 'Completed') {
    paid = amount;
    due = 0;
  } else if (appt.status === 'Accepted') {
    paid = 0;
    due = amount;
  } else if (ps === 'Paid') {
    paid = amount;
    due = 0;
  } else {
    paid = 0;
    due = amount;
  }

  const payload = {
    appointmentId: appt._id,
    doctorId: appt.doctorId || null,
    patientId: appt.patientId || null,
    appointmentDate: appt.appointment_date || new Date(),
    amount,
    paid,
    due,
    revenue: paid, // keep backward compatibility
    status: ps === 'Refund' ? 'Refund' : (paid > 0 ? 'Paid' : (due > 0 ? 'Due' : 'Adjusted')),
    notes: `Auto-synced from appointment ${appt._id}`,
  };

  const existing = await Report.findOne({ appointmentId: appt._id });
  if (existing) {
    // update fields to match computed payload
    existing.amount = payload.amount;
    existing.revenue = payload.revenue;
    existing.due = payload.due;
    existing.status = payload.status;
    existing.appointmentDate = payload.appointmentDate;
    existing.notes = payload.notes;
    await existing.save();
    return existing;
  }
  const created = await Report.create(payload);
  return created;
}
