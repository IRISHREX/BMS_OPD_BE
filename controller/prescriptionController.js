import { catchAsyncErrors } from "../middlewares/catchAsyncErrors.js";
import ErrorHandler from "../middlewares/error.js";
import { Prescription } from "../models/prescriptionSchema.js";
import { User } from "../models/userSchema.js";
import { Appointment } from "../models/appointmentSchema.js";
import { syncReportForAppointment } from "./appointmentController.js";
import {
  uploadPrescriptionPdfToS3,
  deleteS3Object,
  getPresignedDownloadUrl,
} from "../utils/s3Storage.js";

// Create or update prescription for the same day
export const savePrescription = catchAsyncErrors(async (req, res, next) => {
  let {
    patientId,
    doctorId,
    appointmentId,
    presentingComplaints,
    medicalHistory,
    clinicalFindings,
    diagnosys_heading,
    provisionalDiagnosis,
    pathologyReport,
    radiologyReport,
    femaleTests,
    gravida,
    parity,
    LMP,
    EDD,
    POG,
    LCB,
    MOD,
    vitals,
    medicines,
    advice,
    additionalAdvice,
    followUp,
  } = req.body;

  if (!patientId) {
    return next(new ErrorHandler("Patient ID is required", 400));
  }

  // Doctor resolution fallback if missing
  if (!doctorId && appointmentId) {
    try {
      const appt = await Appointment.findById(appointmentId);
      if (appt && appt.doctorId) doctorId = appt.doctorId;
    } catch (e) {
      console.warn("Could not find appointment for doctorId resolution:", e.message);
    }
  }

  if (!doctorId && req.user && req.user._id) {
    doctorId = req.user._id;
  }

  if (!doctorId) {
    try {
      const latestAppt = await Appointment.findOne({ patientId }).sort({ appointment_date: -1 });
      if (latestAppt && latestAppt.doctorId) doctorId = latestAppt.doctorId;
    } catch (e) {
      console.warn("Could not find latest appointment for doctorId resolution:", e.message);
    }
  }

  if (!doctorId) {
    const defaultDoctor = await User.findOne({ role: "Doctor" });
    if (defaultDoctor) {
      doctorId = defaultDoctor._id;
    }
  }

  if (!doctorId) {
    return next(new ErrorHandler("Doctor ID is required", 400));
  }

  const mergedFemaleTests = femaleTests || {
    Gravida: gravida || "",
    Parity: parity || "",
    LMP: LMP || "",
    EDD: EDD || "",
    POG: POG || "",
    LCB: LCB || "",
    MOD: MOD || "",
  };

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const endOfToday = new Date();
  endOfToday.setHours(23, 59, 59, 999);

  // Check if a prescription exists for this patient created today
  let prescription = await Prescription.findOne({
    patientId,
    createdAt: { $gte: today, $lte: endOfToday }
  });

  if (prescription) {
    // Update existing
    prescription.doctorId = doctorId;
    prescription.presentingComplaints = presentingComplaints || prescription.presentingComplaints || "";
    prescription.medicalHistory = medicalHistory || "";
    prescription.clinicalFindings = clinicalFindings || {};
    prescription.diagnosys_heading = diagnosys_heading || prescription.diagnosys_heading || "Provisional Diagnosis";
    prescription.provisionalDiagnosis = provisionalDiagnosis || "";
    prescription.pathologyReport = pathologyReport || "";
    prescription.radiologyReport = radiologyReport || "";
    prescription.femaleTests = mergedFemaleTests;
    prescription.vitals = vitals || {};
    prescription.medicines = medicines || [];
    prescription.advice = advice || {};
    prescription.additionalAdvice = additionalAdvice || "";
    prescription.followUp = followUp || "";
    if (appointmentId) prescription.appointmentId = appointmentId;

    await prescription.save();
  } else {
    // Create new
    prescription = await Prescription.create({
      patientId,
      doctorId,
      appointmentId,
      presentingComplaints: presentingComplaints || "",
      medicalHistory: medicalHistory || "",
      clinicalFindings: clinicalFindings || {},
      diagnosys_heading: diagnosys_heading || "Provisional Diagnosis",
      provisionalDiagnosis: provisionalDiagnosis || "",
      pathologyReport: pathologyReport || "",
      radiologyReport: radiologyReport || "",
      femaleTests: mergedFemaleTests,
      vitals: vitals || {},
      medicines: medicines || [],
      advice: advice || {},
      additionalAdvice: additionalAdvice || "",
      followUp: followUp || "",
    });
  }

  // Enforce max 3 prescriptions per patient: prune older records beyond latest 3
  try {
    const allPatientPrescriptions = await Prescription.find({ patientId }).sort({ createdAt: -1 });
    if (allPatientPrescriptions.length > 3) {
      const toDelete = allPatientPrescriptions.slice(3);
      for (const oldPres of toDelete) {
        await Prescription.findByIdAndDelete(oldPres._id);
      }
    }
  } catch (pruneErr) {
    console.warn("Could not prune old prescriptions:", pruneErr.message);
  }

  // Also sync the associated Appointment status to 'Completed' and update its result
  try {
    let targetApptId = appointmentId;
    if (!targetApptId) {
      const latestAppt = await Appointment.findOne({ patientId }).sort({ appointment_date: -1 });
      if (latestAppt) targetApptId = latestAppt._id;
    }

    if (targetApptId) {
      const normalizedResultItem = {
        initialComplain: typeof provisionalDiagnosis === "object" ? provisionalDiagnosis?.value : provisionalDiagnosis,
        medicalHistory: medicalHistory || "",
        clinical_findings: clinicalFindings || {},
        diagnosys_heading: diagnosys_heading || "Provisional Diagnosis",
        pathologyReport: pathologyReport || "",
        radiologyReport: radiologyReport || "",
        availableReports: {
          pathology: pathologyReport || "",
          radiology: radiologyReport || "",
        },
        additionalAdvice: additionalAdvice || "",
        followUp: followUp || "",
        presentingComplaints: presentingComplaints || "",
        Gravida: mergedFemaleTests?.Gravida || "",
        Parity: mergedFemaleTests?.Parity || "",
        LMP: mergedFemaleTests?.LMP || "",
        EDD: mergedFemaleTests?.EDD || "",
        POG: mergedFemaleTests?.POG || "",
        LCB: mergedFemaleTests?.LCB || "",
        MOD: mergedFemaleTests?.MOD || "",
        diagnosys: vitals || {},
        medicineAdvice: (medicines || []).map((m) => ({
          ...m,
          instruction: m.notes || m.instruction || m.instructions || "",
          notes: m.notes || m.instruction || m.instructions || "",
        })),
        advice: advice || {},
      };

      await Appointment.findByIdAndUpdate(targetApptId, {
        status: "Completed",
        result: [normalizedResultItem],
        followup_date: followUp || undefined,
      });

      try {
        await syncReportForAppointment(targetApptId);
      } catch (repErr) {
        console.warn("Could not sync report entry after prescription save:", repErr.message);
      }
    }
  } catch (syncErr) {
    console.warn("Could not sync appointment with prescription:", syncErr.message);
  }

  res.status(200).json({
    success: true,
    message: "Prescription saved successfully!",
    prescription,
  });
});

export const getLatestPrescriptions = catchAsyncErrors(async (req, res, next) => {
  const { id } = req.params; // patientId

  // Fetch up to 3 latest prescriptions for the patient with full doctor & patient details
  const prescriptions = await Prescription.find({ patientId: id })
    .populate(
      "doctorId",
      "firstName lastName email phone doctorDepartment qualifications headerImage footerImage signImage stampImage prescriptionTemplate"
    )
    .populate("patientId", "firstName lastName gender dob age phone address nic")
    .sort({ createdAt: -1 })
    .limit(3);

  res.status(200).json({
    success: true,
    prescriptions,
  });
});

export const getPrescriptionById = catchAsyncErrors(async (req, res, next) => {
  const { id } = req.params;
  const prescription = await Prescription.findById(id).populate("doctorId", "firstName lastName email phone");

  if (!prescription) {
    return next(new ErrorHandler("Prescription not found!", 404));
  }

  res.status(200).json({
    success: true,
    prescription,
  });
});

export const searchPrescriptions = catchAsyncErrors(async (req, res, next) => {
  const { query } = req.query;

  if (!query) {
    const prescriptions = await Prescription.find()
      .populate("doctorId", "firstName lastName email phone")
      .populate("patientId", "firstName lastName nic phone")
      .sort({ createdAt: -1 })
      .limit(20);
    return res.status(200).json({ success: true, prescriptions });
  }

  // Find users matching query
  const users = await User.find({
    $or: [
      { firstName: { $regex: query, $options: "i" } },
      { lastName: { $regex: query, $options: "i" } },
      { nic: { $regex: query, $options: "i" } },
      { phone: { $regex: query, $options: "i" } },
    ]
  }).select("_id");

  const userIds = users.map((u) => u._id);

  const prescriptions = await Prescription.find({ patientId: { $in: userIds } })
    .populate("doctorId", "firstName lastName email phone")
    .populate("patientId", "firstName lastName nic phone")
    .sort({ createdAt: -1 });

  res.status(200).json({
    success: true,
    prescriptions,
  });
});

// ─── Prescription PDF Management ──────────────────────────────────────────────

/**
 * POST /api/v1/prescription/pdf/:prescriptionId
 * Body: raw PDF buffer (Content-Type: application/pdf)
 *
 * Rules:
 *   • Same calendar-day → overwrite the existing pdfFiles entry (same S3 key)
 *   • Different day      → push a new entry
 *   • > 3 entries        → delete the oldest from S3 + remove from DB
 */
export const savePrescriptionPdf = catchAsyncErrors(async (req, res, next) => {
  const { prescriptionId } = req.params;

  const prescription = await Prescription.findById(prescriptionId);
  if (!prescription) {
    return next(new ErrorHandler("Prescription not found", 404));
  }

  // PDF blob is the raw request body (express.raw middleware must be configured on this route)
  const pdfBuffer = req.body;
  if (!pdfBuffer || pdfBuffer.length === 0) {
    return next(new ErrorHandler("PDF data is required", 400));
  }

  const todayStr = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const patientId = prescription.patientId.toString();

  // Check if there is already an entry for today
  const todayIdx = prescription.pdfFiles.findIndex((f) => f.date === todayStr);

  let s3Key;
  if (todayIdx !== -1) {
    // Same day – reuse the same S3 key so it overwrites
    s3Key = prescription.pdfFiles[todayIdx].s3Key;
    await uploadPrescriptionPdfToS3(patientId, prescriptionId, todayStr, pdfBuffer);
    prescription.pdfFiles[todayIdx].savedAt = new Date();
    prescription.pdfFiles[todayIdx].s3Key = s3Key;
  } else {
    // New day – upload and push entry
    s3Key = await uploadPrescriptionPdfToS3(patientId, prescriptionId, todayStr, pdfBuffer);
    prescription.pdfFiles.push({ date: todayStr, s3Key, s3Url: "", savedAt: new Date() });

    // Sort oldest-first so we can trim from the front
    prescription.pdfFiles.sort((a, b) => (a.date < b.date ? -1 : 1));

    // Enforce 3-file cap – delete the oldest
    while (prescription.pdfFiles.length > 3) {
      const oldest = prescription.pdfFiles.shift();
      if (oldest.s3Key) {
        await deleteS3Object(oldest.s3Key).catch(() => {});
      }
    }
  }

  await prescription.save();

  // Return a fresh presigned URL for the saved file
  const presignedUrl = await getPresignedDownloadUrl(s3Key);

  res.status(200).json({
    success: true,
    message: "Prescription PDF saved successfully",
    date: todayStr,
    presignedUrl,
    pdfFiles: prescription.pdfFiles.map((f) => ({ date: f.date, savedAt: f.savedAt })),
  });
});

/**
 * GET /api/v1/prescription/pdf-list/:patientId
 * Returns all saved PDF dates for a patient with fresh presigned download URLs.
 */
export const listPrescriptionPdfs = catchAsyncErrors(async (req, res, next) => {
  const { patientId } = req.params;

  // Find all prescriptions for this patient that have at least one pdfFile
  const prescriptions = await Prescription.find({ patientId, "pdfFiles.0": { $exists: true } })
    .sort({ createdAt: -1 });

  const files = [];
  for (const presc of prescriptions) {
    for (const f of presc.pdfFiles) {
      if (!f.s3Key) continue;
      const url = await getPresignedDownloadUrl(f.s3Key);
      if (url) {
        files.push({
          prescriptionId: presc._id,
          date: f.date,
          savedAt: f.savedAt,
          presignedUrl: url,
        });
      }
    }
  }

  // Sort newest-first
  files.sort((a, b) => (a.date > b.date ? -1 : 1));

  res.status(200).json({ success: true, files });
});
