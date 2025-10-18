import { catchAsyncErrors } from "../middlewares/catchAsyncErrors.js";
import ErrorHandler from "../middlewares/error.js";
import mongoose from "mongoose";
import { Invoice } from "../models/invoiceSchema.js";
import { Appointment } from "../models/appointmentSchema.js";

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
      // Count appointment price as revenue only when paymentStatus is Paid AND status is Completed
      if (a.paymentStatus === 'Paid' && a.status === 'Completed') {
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
