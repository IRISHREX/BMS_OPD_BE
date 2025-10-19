import { catchAsyncErrors } from "../middlewares/catchAsyncErrors.js";
import ErrorHandler from "../middlewares/error.js";
import mongoose from "mongoose";
import { Invoice } from "../models/invoiceSchema.js";
import { Appointment } from "../models/appointmentSchema.js";
import { Report } from "../models/reportSchema.js";

// Helper to parse ISO date (day start / day end)
const parseRange = (start, end) => {
  let s = start ? new Date(start) : null;
  let e = end ? new Date(end) : null;
  if (s && isNaN(s.getTime())) s = null;
  if (e && isNaN(e.getTime())) e = null;
  // if only start provided, set end to same day end
  if (s && !e) {
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
  if (doctorId) invMatch.doctor = mongoose.Types.ObjectId(doctorId);

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
    if (doctorId) apptMatch.doctorId = mongoose.Types.ObjectId(doctorId);
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

  res.status(200).json({ success: true, totals: { revenue: totalRevenue, due: totalDue }, byPeriod: periods });
});

// List / search persisted report entries
export const listReports = catchAsyncErrors(async (req, res, next) => {
  const { start, end, appointmentId, q, doctorId, page = 1, limit = 50 } = req.query;
  const filter = {};
  if (appointmentId) filter.appointmentId = appointmentId;
  if (doctorId) filter.doctorId = doctorId;
  if (start || end) filter.appointmentDate = {};
  if (start) filter.appointmentDate.$gte = new Date(start);
  if (end) filter.appointmentDate.$lte = new Date(end);
  if (q) {
    const regex = new RegExp(q, 'i');
    // search patient name/phone via join is heavier; allow appointmentId or notes search
    filter.$or = [{ notes: regex }];
  }
  const skip = (Number(page) - 1) * Number(limit);
  const total = await Report.countDocuments(filter);
  const entries = await Report.find(filter).sort({ appointmentDate: -1 }).skip(skip).limit(Number(limit)).populate('doctorId', 'firstName lastName').populate('patientId', 'firstName lastName').lean();
  res.status(200).json({ success: true, total, page: Number(page), limit: Number(limit), entries });
});

// Create or update a report entry (admin)
export const upsertReport = catchAsyncErrors(async (req, res, next) => {
  const payload = req.body;
  if (!payload.appointmentId) return next(new ErrorHandler('appointmentId required', 400));
  const existing = await Report.findOne({ appointmentId: payload.appointmentId });
  if (existing) {
    Object.assign(existing, payload);
    await existing.save();
    return res.status(200).json({ success: true, report: existing });
  }
  const created = await Report.create(payload);
  res.status(201).json({ success: true, report: created });
});

// Update specific report entry (partial updates allowed)
export const updateReport = catchAsyncErrors(async (req, res, next) => {
  const { id } = req.params;
  const payload = req.body;
  const entry = await Report.findById(id);
  if (!entry) return next(new ErrorHandler('Report entry not found', 404));
  Object.assign(entry, payload);
  await entry.save();
  res.status(200).json({ success: true, report: entry });
});

// Delete report entry
export const deleteReport = catchAsyncErrors(async (req, res, next) => {
  const { id } = req.params;
  const entry = await Report.findById(id);
  if (!entry) return next(new ErrorHandler('Report entry not found', 404));
  await entry.deleteOne();
  res.status(200).json({ success: true, message: 'Report entry deleted' });
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
  if (appt.status === 'Completed') {
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
    status: paid > 0 ? 'Paid' : (due > 0 ? 'Due' : 'Adjusted'),
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
