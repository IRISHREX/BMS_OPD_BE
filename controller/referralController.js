import { Referral } from "../models/referralSchema.js";
import { Appointment } from "../models/appointmentSchema.js";
import { User } from "../models/userSchema.js";
import { Invoice } from "../models/invoiceSchema.js";
import { Message } from "../models/messageSchema.js";
import ErrorHandler from "../middlewares/error.js";
import { catchAsyncErrors } from "../middlewares/catchAsyncErrors.js";
import { syncReportForAppointment } from "./appointmentController.js";
import validator from "validator";

// Create Referral (Doctor Outbound Referral to Hospital / Clinic)
export const createReferral = catchAsyncErrors(async (req, res, next) => {
  const {
    patientId,
    patientName,
    age,
    gender,
    abhaId,
    nic,
    diagnosis,
    clinicalNotes,
    requiredCare,
    urgency,
    hospitals,
    queryParams,
    attachments,
  } = req.body;

  if (!patientName) {
    return next(new ErrorHandler("Patient name is required", 400));
  }

  const referral = new Referral({
    referralType: "doctor_referral",
    patientId: patientId || undefined,
    patientName,
    age,
    gender,
    abhaId,
    nic,
    diagnosis: diagnosis || "Specialist Evaluation Required",
    clinicalNotes: clinicalNotes || "Doctor referral to hospital/clinic",
    requiredCare,
    urgency: urgency || "routine",
    hospitals: hospitals || [],
    queryParams: queryParams || {},
    attachments: attachments || [],
    referredBy: req.user?._id,
    referredByName: (req.user?.firstName || "Dr.") + " " + (req.user?.lastName || "Physician"),
    referredBySpecialty: req.user?.specialty || req.user?.specialization,
  });

  await referral.save();

  res.status(201).json({
    success: true,
    message: "Referral created successfully",
    referral,
  });
});

// Get All Referrals
export const getAllReferrals = catchAsyncErrors(async (req, res, next) => {
  const { page = 1, limit = 10, status, urgency, patientId, referredBy, referralType, doctorId } = req.query;

  const skip = (parseInt(page) - 1) * parseInt(limit);
  const query = {};

  if (status) query.status = status;
  if (urgency) query.urgency = urgency;
  if (patientId) query.patientId = patientId;
  if (referredBy) query.referredBy = referredBy;
  if (referralType) query.referralType = referralType;
  if (doctorId) {
    query.$or = [{ targetDoctorId: doctorId }, { referredBy: doctorId }];
  }

  const referrals = await Referral.find(query)
    .populate("patientId", "firstName lastName email phone")
    .populate("referredBy", "firstName lastName specialty specialization")
    .populate("targetDoctorId", "firstName lastName specialization doctorDepartment email phone")
    .populate("appointmentId", "appointment_date status doctor department")
    .populate("hospitals.hospitalId", "name address")
    .limit(parseInt(limit))
    .skip(skip)
    .sort({ createdAt: -1 });

  const total = await Referral.countDocuments(query);

  res.status(200).json({
    success: true,
    referrals,
    pagination: {
      total,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit)),
    },
  });
});

// Book Patient Referral (Normal users / applicants booking an appointment with a doctor)
export const bookPatientReferral = catchAsyncErrors(async (req, res, next) => {
  const {
    patientName,
    patientPhone,
    patientEmail,
    patientAddress,
    age,
    gender,
    nic,
    abhaId,
    targetDoctorId,
    targetDoctorName,
    department,
    appointmentDate,
    appointmentSlot,
    applicantBy,
    applicantName,
    applicantPhone,
    applicantEmail,
    symptoms,
    clinicalNotes,
    urgency,
    commissionPercent,
  } = req.body;

  if (!patientName) {
    return next(new ErrorHandler("Patient name is required", 400));
  }

  let doctorName = targetDoctorName || "";
  let doctorSpecialty = "";
  let doctorDept = department || "General";

  if (targetDoctorId) {
    try {
      const doc = await User.findById(targetDoctorId);
      if (doc) {
        doctorName = `Dr. ${doc.firstName || ""} ${doc.lastName || ""}`.trim();
        doctorSpecialty = doc.specialization || doc.specialty || "";
        if (doc.doctorDepartment) doctorDept = doc.doctorDepartment;
      }
    } catch (e) {
      console.warn("Could not resolve doctor ID:", targetDoctorId);
    }
  }

  // Determine referrer user (authenticated user OR auto-create guest user)
  let referrerUser = req.user || null;
  let authToken = null;
  let tempPassword = null;
  let createdNewUser = false;

  const bookerName = (applicantName || (applicantBy === "Self" ? patientName : "Applicant")).trim();
  const bookerPhone = (applicantPhone || patientPhone || "").trim();
  const bookerEmail = (applicantEmail || patientEmail || "").trim();

  if (!referrerUser) {
    // Check if a user already exists with this phone or email
    try {
      if (bookerPhone && bookerPhone.length >= 10) {
        referrerUser = await User.findOne({ phone: bookerPhone });
      }
      if (!referrerUser && bookerEmail) {
        referrerUser = await User.findOne({ email: bookerEmail.toLowerCase() });
      }

      if (!referrerUser) {
        // Create new guest referral user with random temporary password
        const randomNum = Math.floor(1000 + Math.random() * 9000);
        tempPassword = `Ref@${randomNum}`;
        const nameParts = bookerName.split(" ");
        const firstName = nameParts[0] || "Referral";
        const lastName = nameParts.slice(1).join(" ") || "User";
        const emailFallback = bookerEmail || `ref_${Date.now()}@opd.local`;

        referrerUser = new User({
          firstName,
          lastName,
          name: bookerName,
          phone: bookerPhone && bookerPhone.length === 10 ? bookerPhone : undefined,
          email: emailFallback.toLowerCase(),
          password: tempPassword,
          role: "Referral",
          gender: gender ? (gender.toLowerCase() === "female" ? "Female" : "Male") : "Male",
        });
        await referrerUser.save();
        createdNewUser = true;
      }

      if (referrerUser && typeof referrerUser.generateJsonWebToken === "function") {
        authToken = referrerUser.generateJsonWebToken();
      }
    } catch (err) {
      console.warn("Guest user resolution/creation error in referral:", err.message);
    }
  }

  const referral = new Referral({
    referralType: "patient_request",
    patientName: patientName.trim(),
    patientPhone: patientPhone || applicantPhone || "",
    patientEmail: patientEmail || applicantEmail || "",
    patientAddress: patientAddress || "Not specified",
    age: age ? Number(age) : undefined,
    gender: gender ? gender.toLowerCase() : "male",
    nic: nic || "",
    abhaId: abhaId || "",
    applicantBy: applicantBy || "Self",
    applicantName: bookerName,
    applicantPhone: bookerPhone,
    applicantEmail: bookerEmail,
    targetDoctorId: targetDoctorId || undefined,
    targetDoctorName: doctorName || "Doctor",
    targetDoctorSpecialty: doctorSpecialty,
    department: doctorDept,
    appointmentDate: appointmentDate ? new Date(appointmentDate) : new Date(),
    appointmentSlot: appointmentSlot || "10:00 AM",
    diagnosis: symptoms || "General Consultation Request",
    clinicalNotes: clinicalNotes || symptoms || "Patient self-referral / appointment request",
    urgency: urgency || "routine",
    status: "submitted",
    convertedToAppointment: false,
    referredBy: referrerUser?._id || undefined,
    referredByName: bookerName || "Patient Request",
    commissionPercent: commissionPercent ? Number(commissionPercent) : 5,
    commissionAmount: 0,
    commissionStatus: "pending",
  });

  await referral.save();

  // Create system notification message so it pops up in dashboard & messages
  try {
    const adminUser = await User.findOne({ role: "Admin" });
    const notifRecipient = targetDoctorId || adminUser?._id;
    const notifPhone = (bookerPhone && bookerPhone.length === 10) ? bookerPhone : "9999999999";
    const notifEmail = (bookerEmail && validator.isEmail(bookerEmail)) ? bookerEmail.toLowerCase() : "referrals@thyrogendiagnostic.in";
    const notifMsg = `New Inbound Referral received! Patient: ${patientName.trim()}, Phone: ${bookerPhone || "N/A"}, Doctor: ${doctorName || "General"}, Referrer: ${bookerName || "Guest"}`;

    await Message.create({
      firstName: "Referral",
      lastName: "Notification",
      email: notifEmail,
      phone: notifPhone,
      message: notifMsg,
      recipient: notifRecipient,
      read: false,
    });
  } catch (notifErr) {
    console.warn("Could not create referral notification message:", notifErr.message);
  }

  res.status(201).json({
    success: true,
    message: "Appointment request received successfully as a referral",
    referral,
    token: authToken,
    user: referrerUser ? {
      _id: referrerUser._id,
      firstName: referrerUser.firstName,
      lastName: referrerUser.lastName,
      name: referrerUser.name || `${referrerUser.firstName} ${referrerUser.lastName}`.trim(),
      phone: referrerUser.phone,
      email: referrerUser.email,
      role: referrerUser.role,
    } : null,
    tempPassword: createdNewUser ? tempPassword : null,
  });
});

// Convert Referral to Official Appointment (Admin, Doctors, Compounders)
export const convertToAppointment = catchAsyncErrors(async (req, res, next) => {
  const { id } = req.params;

  const referral = await Referral.findById(id);
  if (!referral) {
    return next(new ErrorHandler("Referral record not found", 404));
  }

  if (referral.convertedToAppointment && referral.appointmentId) {
    let existingAppt = null;
    try {
      existingAppt = await Appointment.findById(referral.appointmentId);
    } catch (e) {
      console.warn("Could not find existing appointment for referral:", e.message);
    }

    // Self-heal: ensure existing appointment has patientId linked
    if (existingAppt && !existingAppt.patientId) {
      let patient = null;
      if (referral.patientId) {
        patient = await User.findById(referral.patientId).catch(() => null);
      }
      if (!patient) {
        const pPhone = (referral.patientPhone || referral.applicantPhone || "").trim();
        const pEmail = (referral.patientEmail || referral.applicantEmail || "").toLowerCase().trim();
        const pNic = (referral.nic || "").trim();
        const queries = [];
        if (pPhone) queries.push({ phone: pPhone });
        if (pEmail && validator.isEmail(pEmail) && !pEmail.includes("patient@opd.local") && !pEmail.includes("biomechasoft.com")) {
          queries.push({ email: pEmail });
        }
        if (pNic) queries.push({ nic: pNic });
        if (queries.length > 0) {
          patient = await User.findOne({ $or: queries, role: "Patient" });
        }
      }
      if (!patient) {
        const rawName = (referral.patientName || "").trim();
        const nameParts = rawName.replace(/\s+/g, " ").split(" ").filter(Boolean);
        const firstName = nameParts[0] || "Patient";
        const lastName = nameParts.slice(1).join(" ") || "";
        const rawPhone = (referral.patientPhone || referral.applicantPhone || "").replace(/\D/g, "");
        const phoneToUse = rawPhone.length >= 10 ? rawPhone.slice(-10) : undefined;
        const emailCand = (referral.patientEmail || referral.applicantEmail || "").toLowerCase().trim();
        const emailToUse = (emailCand && validator.isEmail(emailCand) && !emailCand.includes("patient@opd.local") && !emailCand.includes("biomechasoft.com"))
          ? emailCand
          : `${firstName.toLowerCase().replace(/[^a-z0-9]/g, "")}.${Date.now().toString().slice(-4)}@thyrogen.local`;
        const nicToUse = (referral.nic || "").trim() || (phoneToUse ? phoneToUse.slice(0, 13).padEnd(13, "0") : undefined);
        const ageVal = referral.age || 30;
        const now = new Date();
        const dobDate = new Date(now.getFullYear() - Number(ageVal), now.getMonth(), now.getDate());

        patient = await User.create({
          firstName,
          lastName,
          name: rawName || `${firstName} ${lastName}`.trim(),
          email: emailToUse,
          phone: phoneToUse,
          nic: nicToUse,
          dob: dobDate,
          gender: (referral.gender && referral.gender.toLowerCase() === "female") ? "Female" : "Male",
          password: "defaultPassword123",
          role: "Patient",
          age: ageVal,
        });
      }
      existingAppt.patientId = patient._id;
      await existingAppt.save();
      referral.patientId = patient._id;
      await referral.save();
    }

    return res.status(200).json({
      success: true,
      message: "Referral has already been converted to an appointment",
      appointmentId: referral.appointmentId,
      appointment: existingAppt,
      referral,
    });
  }

  // Determine doctor details and doctor consultation fee
  let doctorFirstName = "Dr.";
  let doctorLastName = "Practitioner";
  let docId = referral.targetDoctorId;
  let doctorFees = 500;

  if (docId) {
    try {
      const doc = await User.findById(docId);
      if (doc) {
        doctorFirstName = doc.firstName || "Dr.";
        doctorLastName = doc.lastName || "Physician";
        doctorFees = doc.consultationFee || doc.fees || doc.visitingFee || 500;
      }
    } catch (e) {
      console.warn("Doctor lookup failed:", e);
    }
  } else if (referral.targetDoctorName) {
    const cleanName = referral.targetDoctorName.replace(/^Dr\.?\s*/i, "").trim();
    const parts = cleanName.split(" ");
    doctorFirstName = parts[0] || "Dr.";
    doctorLastName = parts.slice(1).join(" ") || "Physician";
  } else if (req.user && (req.user.role === "doctor" || req.user.role === "Doctor")) {
    doctorFirstName = req.user.firstName || "Dr.";
    doctorLastName = req.user.lastName || "Physician";
    docId = req.user._id;
    doctorFees = req.user.consultationFee || req.user.fees || req.user.visitingFee || 500;
  }

  const appointmentDateStr = referral.appointmentDate
    ? referral.appointmentDate.toISOString()
    : new Date().toISOString();

  // Determine or create patient User record
  let patient = null;
  if (referral.patientId) {
    try {
      patient = await User.findById(referral.patientId);
    } catch (e) {
      console.warn("Patient lookup failed for referral.patientId:", e.message);
    }
  }

  const patientPhone = (referral.patientPhone || referral.applicantPhone || "").trim();
  const patientEmail = (referral.patientEmail || referral.applicantEmail || "").toLowerCase().trim();
  const patientNic = (referral.nic || "").trim();

  if (!patient) {
    const searchQueries = [];
    if (patientPhone) searchQueries.push({ phone: patientPhone });
    if (patientEmail && validator.isEmail(patientEmail) && !patientEmail.includes("patient@opd.local") && !patientEmail.includes("biomechasoft.com")) {
      searchQueries.push({ email: patientEmail });
    }
    if (patientNic) searchQueries.push({ nic: patientNic });

    if (searchQueries.length > 0) {
      patient = await User.findOne({
        $or: searchQueries,
        role: "Patient",
      });
    }
  }

  if (!patient) {
    const rawName = (referral.patientName || "").trim();
    const nameParts = rawName.replace(/\s+/g, " ").split(" ").filter(Boolean);
    const firstName = nameParts[0] || "Patient";
    const lastName = nameParts.slice(1).join(" ") || "";
    const rawDigits = (patientPhone || "").replace(/\D/g, "");
    const phoneToUse = rawDigits.length >= 10 ? rawDigits.slice(-10) : undefined;
    const emailToUse = (patientEmail && validator.isEmail(patientEmail) && !patientEmail.includes("patient@opd.local") && !patientEmail.includes("biomechasoft.com"))
      ? patientEmail
      : `${firstName.toLowerCase().replace(/[^a-z0-9]/g, "")}.${Date.now().toString().slice(-4)}@thyrogen.local`;
    const nicToUse = patientNic || (phoneToUse ? phoneToUse.slice(0, 13).padEnd(13, "0") : undefined);

    let dobDate = null;
    const ageVal = referral.age || 30;
    const now = new Date();
    dobDate = new Date(now.getFullYear() - Number(ageVal), now.getMonth(), now.getDate());

    patient = await User.create({
      firstName,
      lastName,
      name: rawName || `${firstName} ${lastName}`.trim(),
      email: emailToUse,
      phone: phoneToUse,
      nic: nicToUse,
      dob: dobDate,
      gender: (referral.gender && referral.gender.toLowerCase() === "female") ? "Female" : "Male",
      password: "defaultPassword123",
      role: "Patient",
      age: ageVal,
    });
  }

  const newAppointment = new Appointment({
    name: referral.patientName || patient.name || `${patient.firstName} ${patient.lastName}`.trim(),
    phone: referral.patientPhone || referral.applicantPhone || patient.phone || "0000000000",
    email: referral.patientEmail || referral.applicantEmail || patient.email || "patient@opd.local",
    age: referral.age || patient.age || 30,
    gender: (referral.gender && referral.gender.toLowerCase() === "female") ? "Female" : "Male",
    appointment_date: appointmentDateStr,
    department: referral.department || "General",
    doctor: {
      firstName: doctorFirstName,
      lastName: doctorLastName,
    },
    doctorId: docId || req.user?._id,
    patientId: patient._id,
    price: doctorFees,
    paymentStatus: "Due",
    hasVisited: false,
    address: referral.patientAddress || "Local OPD Patient",
    status: "Accepted",
    booked_by: req.user?._id,
    book_by_name: req.user ? `${req.user.firstName || ''} ${req.user.lastName || ''}`.trim() : "Clinic Staff",
    result: [
      {
        initialComplain: referral.clinicalNotes || "Referred booking request",
        presentingComplaints: referral.diagnosis || "",
      },
    ],
  });

  await newAppointment.save();

  // Auto-generate invoice for referral appointment
  try {
    const genInvoiceNumber = `INV-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${Date.now().toString().slice(-6)}`;
    const platformFee = 50;
    const consultationFee = Number(doctorFees || 500);
    const invoiceTotal = consultationFee + platformFee;
    await Invoice.create({
      invoiceNumber: genInvoiceNumber,
      appointment: newAppointment._id,
      patient: patient._id,
      doctor: docId || req.user?._id,
      items: [
        { description: "Consultation Fee", quantity: 1, unitPrice: consultationFee, total: consultationFee },
        { description: "Platform Fee", quantity: 1, unitPrice: platformFee, total: platformFee },
      ],
      subtotal: invoiceTotal,
      tax: 0,
      discount: 0,
      total: invoiceTotal,
      status: "Unpaid",
      payments: [],
    });
  } catch (invErr) {
    console.warn("Auto-invoice generation error for referral appointment:", invErr.message);
  }

  try {
    await syncReportForAppointment(newAppointment._id);
  } catch (e) {
    console.warn("Failed to sync report for converted appointment:", e.message);
  }

  referral.convertedToAppointment = true;
  referral.appointmentId = newAppointment._id;
  referral.patientId = patient._id;
  referral.status = "scheduled";
  referral.convertedAt = new Date();
  referral.convertedBy = req.user?._id;
  await referral.save();

  res.status(200).json({
    success: true,
    message: "Referral successfully added as an appointment",
    appointment: newAppointment,
    referral,
  });
});

// Get Referral by ID
export const getReferralById = catchAsyncErrors(async (req, res, next) => {
  const { id } = req.params;

  const referral = await Referral.findById(id)
    .populate("patientId", "firstName lastName email phone")
    .populate("referredBy", "firstName lastName specialty")
    .populate("hospitals.hospitalId", "name address city")
    .populate("acceptedHospitalId", "name address");

  if (!referral) {
    return next(new ErrorHandler("Referral not found", 404));
  }

  res.status(200).json({
    success: true,
    referral,
  });
});

// Update Referral
export const updateReferral = catchAsyncErrors(async (req, res, next) => {
  const { id } = req.params;
  const updateData = req.body;

  let referral = await Referral.findById(id);

  if (!referral) {
    return next(new ErrorHandler("Referral not found", 404));
  }

  // Update allowed fields
  const allowedFields = [
    "diagnosis",
    "clinicalNotes",
    "requiredCare",
    "urgency",
    "hospitals",
    "queryParams",
    "status",
    "notes",
  ];

  allowedFields.forEach((field) => {
    if (updateData[field] !== undefined) {
      if (field === "hospitals" || field === "queryParams") {
        referral[field] = { ...referral[field], ...updateData[field] };
      } else {
        referral[field] = updateData[field];
      }
    }
  });

  await referral.save();

  res.status(200).json({
    success: true,
    message: "Referral updated successfully",
    referral,
  });
});

// Delete Referral
export const deleteReferral = catchAsyncErrors(async (req, res, next) => {
  const { id } = req.params;

  const referral = await Referral.findByIdAndDelete(id);

  if (!referral) {
    return next(new ErrorHandler("Referral not found", 404));
  }

  res.status(200).json({
    success: true,
    message: "Referral deleted successfully",
  });
});

// Get Referrals by Patient
export const getReferralsByPatient = catchAsyncErrors(async (req, res, next) => {
  const { patientId } = req.params;
  const { page = 1, limit = 10 } = req.query;

  const skip = (parseInt(page) - 1) * parseInt(limit);

  const referrals = await Referral.find({ patientId })
    .populate("hospitals.hospitalId", "name address city")
    .limit(parseInt(limit))
    .skip(skip)
    .sort({ createdAt: -1 });

  const total = await Referral.countDocuments({ patientId });

  res.status(200).json({
    success: true,
    referrals,
    pagination: {
      total,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit)),
    },
  });
});

// Get Referrals by Hospital
export const getReferralsByHospital = catchAsyncErrors(async (req, res, next) => {
  const { hospitalId } = req.params;
  const { page = 1, limit = 10, status } = req.query;

  const skip = (parseInt(page) - 1) * parseInt(limit);
  const query = { "hospitals.hospitalId": hospitalId };

  if (status) query.status = status;

  const referrals = await Referral.find(query)
    .populate("patientId", "firstName lastName email")
    .populate("referredBy", "firstName lastName specialty")
    .limit(parseInt(limit))
    .skip(skip)
    .sort({ createdAt: -1 });

  const total = await Referral.countDocuments(query);

  res.status(200).json({
    success: true,
    referrals,
    pagination: {
      total,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit)),
    },
  });
});

// Get Referrals by Doctor (referredBy)
export const getReferralsByDoctor = catchAsyncErrors(async (req, res, next) => {
  const { doctorId } = req.params;
  const { page = 1, limit = 10, status } = req.query;

  const skip = (parseInt(page) - 1) * parseInt(limit);
  const query = { referredBy: doctorId };

  if (status) query.status = status;

  const referrals = await Referral.find(query)
    .populate("patientId", "firstName lastName email")
    .populate("hospitals.hospitalId", "name address")
    .limit(parseInt(limit))
    .skip(skip)
    .sort({ createdAt: -1 });

  const total = await Referral.countDocuments(query);

  res.status(200).json({
    success: true,
    referrals,
    pagination: {
      total,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit)),
    },
  });
});

// Update Referral Status
export const updateReferralStatus = catchAsyncErrors(async (req, res, next) => {
  const { id } = req.params;
  const { status, rejectionReason, scheduledDate, acceptedHospitalId } = req.body;

  let referral = await Referral.findById(id);

  if (!referral) {
    return next(new ErrorHandler("Referral not found", 404));
  }

  referral.status = status;

  if (status === "rejected" && rejectionReason) {
    referral.rejectionReason = rejectionReason;
  }

  if (status === "accepted") {
    referral.acceptedAt = new Date();
    if (acceptedHospitalId) {
      referral.acceptedHospitalId = acceptedHospitalId;
    }
  }

  if (status === "scheduled" && scheduledDate) {
    referral.scheduledDate = scheduledDate;
  }

  if (status === "admitted") {
    referral.admissionDate = new Date();
  }

  if (status === "completed") {
    referral.dischargeDate = new Date();
    if (referral.commissionStatus !== "paid") {
      let baseFee = 500;
      if (referral.appointmentId) {
        try {
          const appt = await Appointment.findById(referral.appointmentId);
          if (appt && (appt.doctorFee || appt.price)) {
            baseFee = (Number(appt.doctorFee) || 0) + (Number(appt.price) || 0) || 500;
          }
        } catch (_) {}
      }
      referral.commissionAmount = Math.round((baseFee * (referral.commissionPercent || 5)) / 100);
      referral.commissionStatus = "calculated";
    }
  }

  await referral.save();

  res.status(200).json({
    success: true,
    message: "Referral status updated successfully",
    referral,
  });
});

// Search Referrals
export const searchReferrals = catchAsyncErrors(async (req, res, next) => {
  const { q, status, urgency } = req.query;
  const query = {};

  if (q) {
    query.$or = [
      { referralNumber: { $regex: q, $options: "i" } },
      { patientName: { $regex: q, $options: "i" } },
    ];
  }

  if (status) query.status = status;
  if (urgency) query.urgency = urgency;

  const referrals = await Referral.find(query)
    .populate("patientId", "firstName lastName email")
    .populate("hospitals.hospitalId", "name address")
    .sort({ createdAt: -1 });

  res.status(200).json({
    success: true,
    referrals,
  });
});

// Get Referral by Number
export const getReferralByNumber = catchAsyncErrors(async (req, res, next) => {
  const { referralNumber } = req.params;

  const referral = await Referral.findOne({ referralNumber })
    .populate("patientId", "firstName lastName email phone")
    .populate("referredBy", "firstName lastName specialty")
    .populate("hospitals.hospitalId", "name address city")
    .populate("acceptedHospitalId", "name address");

  if (!referral) {
    return next(new ErrorHandler("Referral not found", 404));
  }

  res.status(200).json({
    success: true,
    referral,
  });
});

// Get Referral Statistics
export const getReferralStatistics = catchAsyncErrors(async (req, res, next) => {
  const { doctorId, startDate, endDate } = req.query;

  const query = {};
  if (doctorId) query.referredBy = doctorId;

  if (startDate || endDate) {
    query.createdAt = {};
    if (startDate) query.createdAt.$gte = new Date(startDate);
    if (endDate) query.createdAt.$lte = new Date(endDate);
  }

  const total = await Referral.countDocuments(query);
  const submitted = await Referral.countDocuments({ ...query, status: "submitted" });
  const underReview = await Referral.countDocuments({ ...query, status: "under-review" });
  const accepted = await Referral.countDocuments({ ...query, status: "accepted" });
  const rejected = await Referral.countDocuments({ ...query, status: "rejected" });
  const completed = await Referral.countDocuments({ ...query, status: "completed" });

  const byUrgency = await Referral.aggregate([
    { $match: query },
    { $group: { _id: "$urgency", count: { $sum: 1 } } },
  ]);

  res.status(200).json({
    success: true,
    statistics: {
      total,
      submitted,
      underReview,
      accepted,
      rejected,
      completed,
      byUrgency,
    },
  });
});

// Update Referral Commission (Percentage or manual amount)
export const updateReferralCommission = catchAsyncErrors(async (req, res, next) => {
  const { id } = req.params;
  const { commissionPercent, commissionAmount, commissionStatus } = req.body;

  const referral = await Referral.findById(id);
  if (!referral) return next(new ErrorHandler("Referral not found", 404));

  if (commissionPercent !== undefined) {
    referral.commissionPercent = Math.max(0, Math.min(100, Number(commissionPercent)));
  }
  if (commissionStatus !== undefined) {
    referral.commissionStatus = commissionStatus;
  }
  if (commissionAmount !== undefined) {
    referral.commissionAmount = Number(commissionAmount);
  } else if (referral.commissionStatus !== "paid") {
    // Recalculate based on appointment fee
    let baseAmount = 500;
    if (referral.appointmentId) {
      try {
        const appt = await Appointment.findById(referral.appointmentId);
        if (appt && (appt.price || appt.doctorFee)) {
          baseAmount = (Number(appt.doctorFee) || 0) + (Number(appt.price) || 0) || 500;
        }
      } catch (_) {}
    }
    referral.commissionAmount = Math.round((baseAmount * (referral.commissionPercent || 5)) / 100);
    if (referral.status === "completed" && referral.commissionStatus === "pending") {
      referral.commissionStatus = "calculated";
    }
  }

  await referral.save();

  res.status(200).json({
    success: true,
    message: "Referral commission updated successfully",
    referral,
  });
});

// Pay Referral Commission (Single)
export const payReferralCommission = catchAsyncErrors(async (req, res, next) => {
  const { id } = req.params;
  const referral = await Referral.findById(id);
  if (!referral) return next(new ErrorHandler("Referral not found", 404));

  referral.commissionStatus = "paid";
  if (!referral.commissionAmount || referral.commissionAmount <= 0) {
    const pct = referral.commissionPercent || 5;
    referral.commissionAmount = Math.round((500 * pct) / 100);
  }
  await referral.save();

  res.status(200).json({
    success: true,
    message: `Commission of ₹${referral.commissionAmount} marked as Paid for ${referral.referredByName || referral.applicantName || "Referrer"}`,
    referral,
  });
});

// Bulk Pay Referral Commissions
export const bulkPayReferralCommissions = catchAsyncErrors(async (req, res, next) => {
  const { referralIds } = req.body;
  if (!Array.isArray(referralIds) || referralIds.length === 0) {
    return next(new ErrorHandler("Please provide an array of referralIds to pay", 400));
  }

  const updated = [];
  for (const id of referralIds) {
    const ref = await Referral.findById(id);
    if (ref) {
      ref.commissionStatus = "paid";
      if (!ref.commissionAmount || ref.commissionAmount <= 0) {
        const pct = ref.commissionPercent || 5;
        ref.commissionAmount = Math.round((500 * pct) / 100);
      }
      await ref.save();
      updated.push(ref);
    }
  }

  res.status(200).json({
    success: true,
    message: `Successfully marked ${updated.length} referral commissions as Paid`,
    count: updated.length,
  });
});

// Bulk Delete Referrals
export const bulkDeleteReferrals = catchAsyncErrors(async (req, res, next) => {
  const { referralIds } = req.body;
  if (!Array.isArray(referralIds) || referralIds.length === 0) {
    return next(new ErrorHandler("Please provide an array of referralIds to delete", 400));
  }

  const result = await Referral.deleteMany({ _id: { $in: referralIds } });

  res.status(200).json({
    success: true,
    message: `Successfully deleted ${result.deletedCount} referrals`,
    deletedCount: result.deletedCount,
  });
});
