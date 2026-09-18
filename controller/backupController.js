import mongoose from "mongoose";
import { catchAsyncErrors } from "../middlewares/catchAsyncErrors.js";
import ErrorHandler from "../middlewares/error.js";
import { Appointment } from "../models/appointmentSchema.js";
import { User } from "../models/userSchema.js";
import { BackupSettings } from "../models/backupSettingsSchema.js";

// Helper to get or create settings
const getOrCreateSettings = async () => {
  let settings = await BackupSettings.findOne();
  if (!settings) {
    settings = await BackupSettings.create({
      storageLimitMB: 1024,
      appointmentThreshold: 1000,
    });
  }
  return settings;
};

// 1. Get Backup & Storage Stats
export const getBackupStats = catchAsyncErrors(async (req, res, next) => {
  const settings = await getOrCreateSettings();

  // Total Appointments
  const totalAppointments = await Appointment.countDocuments();

  // Total Patients from User model + distinct names from Appointment
  const patientUsers = await User.countDocuments({ role: "Patient" });
  const appointmentPatients = (await Appointment.distinct("name")).length;
  const totalPatients = Math.max(patientUsers, appointmentPatients);

  // MongoDB Database storage statistics
  let totalSizeBytes = 0;
  let dataSizeBytes = 0;
  let appointmentsSizeBytes = 0;
  let usersSizeBytes = 0;

  try {
    const db = mongoose.connection.db;
    const dbStats = await db.stats();
    totalSizeBytes = (dbStats.storageSize || 0) + (dbStats.indexSize || 0) || dbStats.dataSize || 0;
    dataSizeBytes = dbStats.dataSize || 0;

    // Collection level sizes if available
    try {
      const apptCollStats = await db.command({ collStats: "appointments" });
      appointmentsSizeBytes = apptCollStats.totalSize || apptCollStats.storageSize || apptCollStats.size || 0;
    } catch (_) {}

    try {
      const userCollStats = await db.command({ collStats: "users" });
      usersSizeBytes = userCollStats.totalSize || userCollStats.storageSize || userCollStats.size || 0;
    } catch (_) {}
  } catch (err) {
    // If collStats/dbStats is restricted, estimate size based on document counts
    totalSizeBytes = totalAppointments * 4096 + totalPatients * 2048 + 1024 * 1024 * 5;
  }

  const usedMB = Number((totalSizeBytes / (1024 * 1024)).toFixed(2));
  const appointmentsMB = Number((appointmentsSizeBytes / (1024 * 1024)).toFixed(2));
  const usersMB = Number((usersSizeBytes / (1024 * 1024)).toFixed(2));
  const limitMB = settings.storageLimitMB || 1024;
  const appointmentThreshold = settings.appointmentThreshold || 1000;

  res.status(200).json({
    success: true,
    stats: {
      usedMB,
      limitMB,
      usedPercentage: Math.min(100, Number(((usedMB / limitMB) * 100).toFixed(1))),
      isStorageExceeded: usedMB >= limitMB,
      breakdown: {
        appointmentsMB,
        usersMB,
        otherMB: Math.max(0, Number((usedMB - appointmentsMB - usersMB).toFixed(2))),
      },
      totalAppointments,
      appointmentThreshold,
      isAppointmentsExceeded: totalAppointments >= appointmentThreshold,
      totalPatients,
      lastBackupDate: settings.lastBackupDate,
    },
  });
});

// 2. Export Appointments Data
export const exportAppointmentsData = catchAsyncErrors(async (req, res, next) => {
  const { range = "all", from, to } = req.query;

  let query = {};
  const now = new Date();

  if (range === "today") {
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    query.$or = [
      { createdAt: { $gte: startOfToday, $lte: endOfToday } },
      { appointment_date: { $gte: startOfToday.toISOString().slice(0, 10), $lte: endOfToday.toISOString().slice(0, 10) } }
    ];
  } else if (range === "week") {
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    query.$or = [
      { createdAt: { $gte: weekAgo } },
      { appointment_date: { $gte: weekAgo.toISOString().slice(0, 10) } }
    ];
  } else if (range === "month") {
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    query.$or = [
      { createdAt: { $gte: monthAgo } },
      { appointment_date: { $gte: monthAgo.toISOString().slice(0, 10) } }
    ];
  } else if (range === "custom" && (from || to)) {
    const dateFilter = {};
    if (from) dateFilter.$gte = new Date(from);
    if (to) {
      const toDate = new Date(to);
      toDate.setHours(23, 59, 59, 999);
      dateFilter.$lte = toDate;
    }
    query.$or = [
      { createdAt: dateFilter },
      { appointment_date: { ...(from && { $gte: from }), ...(to && { $lte: to }) } }
    ];
  }

  const appointments = await Appointment.find(query).sort({ createdAt: -1 });

  // Format appointments into clean, human-readable tabular records
  const records = appointments.map((apt, index) => {
    const doctorName = apt.doctor
      ? `Dr. ${apt.doctor.firstName || ""} ${apt.doctor.lastName || ""}`.trim()
      : "N/A";
    
    // Check for vitals
    const report = Array.isArray(apt.report) && apt.report.length > 0 ? apt.report[0] : null;
    const vitals = report?.diagnosys || {};
    const bp = vitals.BP ? `${vitals.BP} mmHg` : "-";
    const pulse = vitals.PR ? `${vitals.PR} bpm` : "-";
    const temp = vitals.Temp ? `${vitals.Temp} F` : "-";
    const weight = vitals.Weight ? `${vitals.Weight} kg` : "-";

    return {
      SL: index + 1,
      AppointmentID: apt.appointmentId || apt._id.toString(),
      Date: apt.appointment_date ? apt.appointment_date.slice(0, 10) : apt.createdAt ? apt.createdAt.toISOString().slice(0, 10) : "-",
      PatientName: apt.name || "N/A",
      Age: apt.age ? `${apt.age} Yrs` : "-",
      Gender: apt.gender || "-",
      Phone: apt.phone || "-",
      Doctor: doctorName,
      Department: apt.department || "General",
      Status: apt.hasVisited ? "Completed" : "Scheduled",
      Payment: apt.isPaid ? "Paid" : "Pending",
      Fee: apt.visitingFee ? `Rs ${apt.visitingFee}` : "-",
      Complaints: apt.initialComplain || report?.presentingComplaints || "-",
      Vitals: `BP: ${bp} | PR: ${pulse} | Temp: ${temp} | Wt: ${weight}`,
      FollowUp: apt.followup_date ? apt.followup_date.slice(0, 10) : report?.followUp ? String(report.followUp).slice(0, 10) : "-",
    };
  });

  // Update last backup date
  await BackupSettings.updateOne({}, { lastBackupDate: new Date() }, { upsert: true });

  res.status(200).json({
    success: true,
    count: records.length,
    range,
    records,
  });
});

// 3. Export Patients Data
export const exportPatientsData = catchAsyncErrors(async (req, res, next) => {
  // 1. Get from User collection where role is Patient
  const patientUsers = await User.find({ role: "Patient" }).sort({ createdAt: -1 });

  // 2. Also aggregate from Appointment collection to ensure every booked patient is included
  const appointmentPatients = await Appointment.aggregate([
    {
      $group: {
        _id: "$name",
        phone: { $first: "$phone" },
        gender: { $first: "$gender" },
        age: { $first: "$age" },
        address: { $first: "$address" },
        totalAppointments: { $sum: 1 },
        lastVisit: { $max: "$createdAt" },
        firstVisit: { $min: "$createdAt" },
      },
    },
    { $sort: { lastVisit: -1 } },
  ]);

  // Combine and de-duplicate by name + phone
  const patientMap = new Map();

  patientUsers.forEach((p) => {
    const key = `${p.name || `${p.firstName} ${p.lastName || ""}`.trim()}_${p.phone || ""}`.toLowerCase();
    patientMap.set(key, {
      PatientID: p._id.toString(),
      Name: p.name || `${p.firstName} ${p.lastName || ""}`.trim(),
      Age: p.age ? `${p.age} Yrs` : "-",
      Gender: p.gender || "-",
      Phone: p.phone || "-",
      Email: p.email || "-",
      Address: p.address || "-",
      TotalVisits: 1,
      RegisteredDate: p.createdAt ? p.createdAt.toISOString().slice(0, 10) : "-",
      LastVisit: p.updatedAt ? p.updatedAt.toISOString().slice(0, 10) : "-",
    });
  });

  appointmentPatients.forEach((ap) => {
    const key = `${ap._id}_${ap.phone || ""}`.toLowerCase();
    if (patientMap.has(key)) {
      const existing = patientMap.get(key);
      existing.TotalVisits = Math.max(existing.TotalVisits, ap.totalAppointments);
      if (ap.lastVisit) existing.LastVisit = ap.lastVisit.toISOString().slice(0, 10);
    } else {
      patientMap.set(key, {
        PatientID: `PT-${Math.abs(key.split("").reduce((a, b) => ((a << 5) - a) + b.charCodeAt(0), 0)).toString(16).slice(0, 8)}`,
        Name: ap._id,
        Age: ap.age ? `${ap.age} Yrs` : "-",
        Gender: ap.gender || "-",
        Phone: ap.phone || "-",
        Email: "-",
        Address: ap.address || "-",
        TotalVisits: ap.totalAppointments,
        RegisteredDate: ap.firstVisit ? ap.firstVisit.toISOString().slice(0, 10) : "-",
        LastVisit: ap.lastVisit ? ap.lastVisit.toISOString().slice(0, 10) : "-",
      });
    }
  });

  const records = Array.from(patientMap.values()).map((p, index) => ({
    SL: index + 1,
    ...p,
  }));

  // Update last backup date
  await BackupSettings.updateOne({}, { lastBackupDate: new Date() }, { upsert: true });

  res.status(200).json({
    success: true,
    count: records.length,
    records,
  });
});

// 4. Update Backup Settings
export const updateBackupSettings = catchAsyncErrors(async (req, res, next) => {
  const { storageLimitMB, appointmentThreshold } = req.body;

  const update = {};
  if (storageLimitMB !== undefined) update.storageLimitMB = Number(storageLimitMB);
  if (appointmentThreshold !== undefined) update.appointmentThreshold = Number(appointmentThreshold);

  const settings = await BackupSettings.findOneAndUpdate({}, update, {
    new: true,
    upsert: true,
  });

  res.status(200).json({
    success: true,
    message: "Backup settings updated successfully",
    settings,
  });
});
