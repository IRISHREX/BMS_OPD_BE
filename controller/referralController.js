import { Referral } from "../models/referralSchema.js";
import ErrorHandler from "../middlewares/error.js";
import { catchAsyncErrors } from "../middlewares/catchAsyncErrors.js";

// Create Referral
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

  if (!patientId || !patientName || !clinicalNotes) {
    const missing = [];
    if (!patientId) missing.push('patientId');
    if (!patientName) missing.push('patientName');
    if (!clinicalNotes) missing.push('clinicalNotes');
    console.error('Missing fields:', missing, 'Received:', { patientId, patientName, diagnosis, clinicalNotes });
    return next(new ErrorHandler(`Required fields missing: ${missing.join(', ')}`, 400));
  }

  const referral = new Referral({
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
    hospitals: hospitals || [],
    queryParams: queryParams || {},
    attachments: attachments || [],
    referredBy: req.user?._id,
    referredByName: req.user?.firstName + " " + req.user?.lastName,
    referredBySpecialty: req.user?.specialty,
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
  const { page = 1, limit = 10, status, urgency, patientId, referredBy } = req.query;

  const skip = (parseInt(page) - 1) * parseInt(limit);
  const query = {};

  if (status) query.status = status;
  if (urgency) query.urgency = urgency;
  if (patientId) query.patientId = patientId;
  if (referredBy) query.referredBy = referredBy;

  const referrals = await Referral.find(query)
    .populate("patientId", "firstName lastName email phone")
    .populate("referredBy", "firstName lastName specialty")
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
