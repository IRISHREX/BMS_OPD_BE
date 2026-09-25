import mongoose from "mongoose";
import { catchAsyncErrors } from "../middlewares/catchAsyncErrors.js";
import ErrorHandler from "../middlewares/error.js";
import { Appointment } from "../models/appointmentSchema.js";
import { User } from "../models/userSchema.js";
import { BackupSettings } from "../models/backupSettingsSchema.js";
import { Medicine } from "../models/medicineSchema.js";
import { logEvent } from "../utils/logger.js";
import { uploadCsvBackupToS3, listS3Backups } from "../utils/s3Storage.js";

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
  const limitMB = (settings.storageLimitMB && settings.storageLimitMB > 0) ? settings.storageLimitMB : 1024;
  const appointmentThreshold = (settings.appointmentThreshold && settings.appointmentThreshold > 0) ? settings.appointmentThreshold : 1000;
  const usedPercentage = Math.min(100, Number(((usedMB / limitMB) * 100).toFixed(1)));

  res.status(200).json({
    success: true,
    stats: {
      usedMB,
      limitMB,
      usedPercentage,
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
  } else if (range === "custom") {
    if (from && isNaN(new Date(from).getTime())) {
      return next(new ErrorHandler("Invalid 'from' date format", 400));
    }
    if (to && isNaN(new Date(to).getTime())) {
      return next(new ErrorHandler("Invalid 'to' date format", 400));
    }
    if (from && to && new Date(from) > new Date(to)) {
      return next(new ErrorHandler("'From' date cannot be after 'To' date", 400));
    }

    const dateFilter = {};
    if (from) dateFilter.$gte = new Date(from);
    if (to) {
      const toDate = new Date(to);
      toDate.setHours(23, 59, 59, 999);
      dateFilter.$lte = toDate;
    }

    if (from || to) {
      query.$or = [
        { createdAt: dateFilter },
        { appointment_date: { ...(from && { $gte: String(from).slice(0, 10) }), ...(to && { $lte: String(to).slice(0, 10) }) } }
      ];
    }
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

  // Log audit event
  logEvent({
    level: "SUCCESS",
    category: "Backup",
    action: "EXPORT_APPOINTMENTS",
    message: `Exported ${records.length} appointment records (range: ${range}).`,
    req,
    metadata: { count: records.length, range },
  });

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
    const pName = p.name || `${p.firstName || ""} ${p.lastName || ""}`.trim() || "Unknown Patient";
    const phone = p.phone || "";
    const key = `${pName}_${phone}`.toLowerCase();
    patientMap.set(key, {
      PatientID: p._id.toString(),
      Name: pName,
      Age: p.age ? `${p.age} Yrs` : "-",
      Gender: p.gender || "-",
      Phone: phone || "-",
      Email: p.email || "-",
      Address: p.address || "-",
      TotalVisits: 1,
      RegisteredDate: p.createdAt ? new Date(p.createdAt).toISOString().slice(0, 10) : "-",
      LastVisit: p.updatedAt ? new Date(p.updatedAt).toISOString().slice(0, 10) : "-",
    });
  });

  appointmentPatients.forEach((ap) => {
    const apName = ap._id || "Unknown Patient";
    const phone = ap.phone || "";
    const key = `${apName}_${phone}`.toLowerCase();

    const formatDateSafe = (d) => {
      if (!d) return "-";
      try {
        return new Date(d).toISOString().slice(0, 10);
      } catch (_) {
        return "-";
      }
    };

    if (patientMap.has(key)) {
      const existing = patientMap.get(key);
      existing.TotalVisits = Math.max(existing.TotalVisits, ap.totalAppointments || 1);
      if (ap.lastVisit) existing.LastVisit = formatDateSafe(ap.lastVisit);
    } else {
      patientMap.set(key, {
        PatientID: `PT-${Math.abs(key.split("").reduce((a, b) => ((a << 5) - a) + b.charCodeAt(0), 0)).toString(16).slice(0, 8)}`,
        Name: apName,
        Age: ap.age ? `${ap.age} Yrs` : "-",
        Gender: ap.gender || "-",
        Phone: phone || "-",
        Email: "-",
        Address: ap.address || "-",
        TotalVisits: ap.totalAppointments || 1,
        RegisteredDate: formatDateSafe(ap.firstVisit),
        LastVisit: formatDateSafe(ap.lastVisit),
      });
    }
  });

  const records = Array.from(patientMap.values()).map((p, index) => ({
    SL: index + 1,
    ...p,
  }));

  // Update last backup date
  await BackupSettings.updateOne({}, { lastBackupDate: new Date() }, { upsert: true });

  // Log audit event
  logEvent({
    level: "SUCCESS",
    category: "Backup",
    action: "EXPORT_PATIENTS",
    message: `Exported ${records.length} patient master records.`,
    req,
    metadata: { count: records.length },
  });

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
  if (storageLimitMB !== undefined) {
    const val = Number(storageLimitMB);
    if (isNaN(val) || val <= 0) {
      return next(new ErrorHandler("Storage limit must be a positive number (MB)", 400));
    }
    update.storageLimitMB = val;
  }
  if (appointmentThreshold !== undefined) {
    const val = Number(appointmentThreshold);
    if (isNaN(val) || val <= 0) {
      return next(new ErrorHandler("Appointment threshold must be a positive number", 400));
    }
    update.appointmentThreshold = val;
  }

  const settings = await BackupSettings.findOneAndUpdate({}, update, {
    new: true,
    upsert: true,
  });

  // Log audit event
  logEvent({
    level: "INFO",
    category: "Settings",
    action: "UPDATE_BACKUP_SETTINGS",
    message: `Updated backup storage threshold to ${settings.storageLimitMB} MB, appointments threshold to ${settings.appointmentThreshold}.`,
    req,
    metadata: { storageLimitMB: settings.storageLimitMB, appointmentThreshold: settings.appointmentThreshold },
  });

  res.status(200).json({
    success: true,
    message: "Backup settings updated successfully",
    settings,
  });
});

// Helper to convert array of objects into RFC4180 compliant CSV string
const toCsvString = (records) => {
  if (!records || records.length === 0) return "";
  const headers = Object.keys(records[0]);
  const rows = records.map((row) =>
    headers
      .map((header) => {
        let val = row[header] === null || row[header] === undefined ? "" : String(row[header]);
        if (val.includes(",") || val.includes('"') || val.includes("\n") || val.includes("\r")) {
          val = `"${val.replace(/"/g, '""')}"`;
        }
        return val;
      })
      .join(",")
  );
  return [headers.join(","), ...rows].join("\r\n");
};

// 5. Trigger automated backup of all clinical data to aiccloud S3 Bucket
export const backupToS3 = catchAsyncErrors(async (req, res, next) => {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const uploadedFiles = [];

  // A. Export Appointments
  const appointments = await Appointment.find().sort({ createdAt: -1 });
  const appointmentRecords = appointments.map((apt, index) => ({
    SL: index + 1,
    AppointmentID: apt.appointmentId || apt._id.toString(),
    PatientName: apt.name || "-",
    Phone: apt.phone || "-",
    Date: apt.appointment_date ? apt.appointment_date.slice(0, 10) : "-",
    Department: apt.department || "-",
    Status: apt.status || "-",
    InitialComplain: apt.initialComplain || "-",
    CreatedAt: apt.createdAt ? apt.createdAt.toISOString() : "-",
  }));
  const appointmentsCsv = toCsvString(appointmentRecords);
  const aptKey = `${timestamp}_appointments.csv`;
  await uploadCsvBackupToS3(aptKey, appointmentsCsv);
  uploadedFiles.push({ file: aptKey, count: appointmentRecords.length, type: "Appointments" });

  // B. Export Patients
  const patientUsers = await User.find({ role: "Patient" });
  const patientRecords = patientUsers.map((p, index) => ({
    SL: index + 1,
    PatientID: p._id.toString(),
    Name: p.name || `${p.firstName || ""} ${p.lastName || ""}`.trim() || "-",
    Phone: p.phone || "-",
    Email: p.email || "-",
    Age: p.age || "-",
    Gender: p.gender || "-",
    Address: p.address || "-",
    CreatedAt: p.createdAt ? p.createdAt.toISOString() : "-",
  }));
  const patientsCsv = toCsvString(patientRecords);
  const ptKey = `${timestamp}_patients.csv`;
  await uploadCsvBackupToS3(ptKey, patientsCsv);
  uploadedFiles.push({ file: ptKey, count: patientRecords.length, type: "Patients" });

  // C. Export Medicines Master
  const medicines = await Medicine.find().lean();
  const medicineRecords = medicines.map((m, index) => ({
    SL: index + 1,
    Name: m.name || "-",
    Type: m.type || "-",
    Composition: Array.isArray(m.composition) ? m.composition.join("; ") : m.composition || "-",
    Dose: m.dose || "-",
    Frequency: m.frequency || "-",
    Route: m.route || "-",
    Duration: m.duration || "-",
    Notes: m.notes || "-",
  }));
  const medicinesCsv = toCsvString(medicineRecords);
  const medKey = `${timestamp}_medicines.csv`;
  await uploadCsvBackupToS3(medKey, medicinesCsv);
  uploadedFiles.push({ file: medKey, count: medicineRecords.length, type: "Medicines" });

  // Update last backup date
  await BackupSettings.updateOne({}, { lastBackupDate: new Date() }, { upsert: true });

  // Audit log
  logEvent({
    level: "SUCCESS",
    category: "Backup",
    action: "S3_BACKUP_TRIGGERED",
    message: `Uploaded 3 CSV backups to S3 (${timestamp}): Appointments, Patients, Medicines.`,
    req,
    metadata: { uploadedFiles },
  });

  res.status(200).json({
    success: true,
    message: "Backup to S3 completed successfully!",
    bucket: "aic-585105c0",
    endpoint: "https://s3.aiccloud.online",
    uploadedFiles,
  });
});

// 6. List backups stored in S3
export const getS3Backups = catchAsyncErrors(async (req, res, next) => {
  const backups = await listS3Backups();
  res.status(200).json({
    success: true,
    count: backups.length,
    backups,
  });
});

