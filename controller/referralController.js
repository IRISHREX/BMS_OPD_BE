import { Referral } from "../models/referralSchema.js";
import { Appointment } from "../models/appointmentSchema.js";
import { User } from "../models/userSchema.js";
import ErrorHandler from "../middlewares/error.js";
import { catchAsyncErrors } from "../middlewares/catchAsyncErrors.js";
import { syncReportForAppointment } from "./appointmentController.js";

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
    return res.status(200).json({
      success: true,
      message: "Referral has already been converted to an appointment",
      appointmentId: referral.appointmentId,
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

  const newAppointment = new Appointment({
    name: referral.patientName,
    phone: referral.patientPhone || referral.applicantPhone || "0000000000",
    email: referral.patientEmail || referral.applicantEmail || "patient@opd.local",
    age: referral.age || 30,
    gender: (referral.gender && referral.gender.toLowerCase() === "female") ? "Female" : "Male",
    appointment_date: appointmentDateStr,
    department: referral.department || "General",
    doctor: {
      firstName: doctorFirstName,
      lastName: doctorLastName,
    },
    doctorId: docId || req.user?._id,
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

  try {
    await syncReportForAppointment(newAppointment._id);
  } catch (e) {
    console.warn("Failed to sync report for converted appointment:", e.message);
  }

  referral.convertedToAppointment = true;
  referral.appointmentId = newAppointment._id;
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
