import { Hospital } from "../models/hospitalSchema.js";
import ErrorHandler from "../middlewares/error.js";
import { catchAsyncErrors } from "../middlewares/catchAsyncErrors.js";

// Create Hospital
export const createHospital = catchAsyncErrors(async (req, res, next) => {
  const { name, address, city, state, zipCode, phone, email, website, features } = req.body;

  if (!name || !address) {
    return next(new ErrorHandler("Hospital name and address are required", 400));
  }

  const hospital = new Hospital({
    name,
    address,
    city,
    state,
    zipCode,
    phone,
    email,
    website,
    features: features || {},
    createdBy: req.user?._id,
  });

  await hospital.save();

  res.status(201).json({
    success: true,
    message: "Hospital created successfully",
    hospital,
  });
});

// Get All Hospitals
export const getAllHospitals = catchAsyncErrors(async (req, res, next) => {
  const { page = 1, limit = 10, active, blocked, specialty, search } = req.query;

  const skip = (parseInt(page) - 1) * parseInt(limit);
  const query = {};

  if (active !== undefined) {
    query.active = active === "true";
  }

  if (blocked !== undefined) {
    query.blocked = blocked === "true";
  }

  if (specialty) {
    query["features.specialty"] = specialty;
  }

  if (search) {
    query.$text = { $search: search };
  }

  const hospitals = await Hospital.find(query)
    .limit(parseInt(limit))
    .skip(skip)
    .sort({ createdAt: -1 });

  const total = await Hospital.countDocuments(query);

  res.status(200).json({
    success: true,
    hospitals,
    pagination: {
      total,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit)),
    },
  });
});

// Get Hospital by ID
export const getHospitalById = catchAsyncErrors(async (req, res, next) => {
  const { id } = req.params;

  const hospital = await Hospital.findById(id);

  if (!hospital) {
    return next(new ErrorHandler("Hospital not found", 404));
  }

  res.status(200).json({
    success: true,
    hospital,
  });
});

// Update Hospital
export const updateHospital = catchAsyncErrors(async (req, res, next) => {
  const { id } = req.params;
  const { name, address, city, state, zipCode, phone, email, website, features, active, blocked } = req.body;

  let hospital = await Hospital.findById(id);

  if (!hospital) {
    return next(new ErrorHandler("Hospital not found", 404));
  }

  if (name) hospital.name = name;
  if (address) hospital.address = address;
  if (city) hospital.city = city;
  if (state) hospital.state = state;
  if (zipCode) hospital.zipCode = zipCode;
  if (phone) hospital.phone = phone;
  if (email) hospital.email = email;
  if (website) hospital.website = website;
  if (features) hospital.features = { ...hospital.features, ...features };
  if (active !== undefined) hospital.active = active;
  if (blocked !== undefined) hospital.blocked = blocked;

  hospital.updatedBy = req.user?._id;
  await hospital.save();

  res.status(200).json({
    success: true,
    message: "Hospital updated successfully",
    hospital,
  });
});

// Delete Hospital
export const deleteHospital = catchAsyncErrors(async (req, res, next) => {
  const { id } = req.params;

  const hospital = await Hospital.findByIdAndDelete(id);

  if (!hospital) {
    return next(new ErrorHandler("Hospital not found", 404));
  }

  res.status(200).json({
    success: true,
    message: "Hospital deleted successfully",
  });
});

// Activate/Deactivate Hospital
export const toggleHospitalStatus = catchAsyncErrors(async (req, res, next) => {
  const { id } = req.params;
  const { active } = req.body;

  let hospital = await Hospital.findById(id);

  if (!hospital) {
    return next(new ErrorHandler("Hospital not found", 404));
  }

  hospital.active = active;
  hospital.updatedBy = req.user?._id;
  await hospital.save();

  res.status(200).json({
    success: true,
    message: `Hospital ${active ? "activated" : "deactivated"} successfully`,
    hospital,
  });
});

// Block/Unblock Hospital
export const toggleHospitalBlock = catchAsyncErrors(async (req, res, next) => {
  const { id } = req.params;
  const { blocked } = req.body;

  let hospital = await Hospital.findById(id);

  if (!hospital) {
    return next(new ErrorHandler("Hospital not found", 404));
  }

  hospital.blocked = blocked;
  hospital.updatedBy = req.user?._id;
  await hospital.save();

  res.status(200).json({
    success: true,
    message: `Hospital ${blocked ? "blocked" : "unblocked"} successfully`,
    hospital,
  });
});

// Search Hospitals
export const searchHospitals = catchAsyncErrors(async (req, res, next) => {
  const { q } = req.query;

  if (!q) {
    return next(new ErrorHandler("Search query is required", 400));
  }

  const hospitals = await Hospital.find(
    { $text: { $search: q }, active: true, blocked: false },
    { score: { $meta: "textScore" } }
  ).sort({ score: { $meta: "textScore" } });

  res.status(200).json({
    success: true,
    hospitals,
  });
});

// Add Doctor to Hospital
export const addDoctorToHospital = catchAsyncErrors(async (req, res, next) => {
  const { id } = req.params;
  const { name, specialty, experience, referrer, qualification, contact } = req.body;

  let hospital = await Hospital.findById(id);

  if (!hospital) {
    return next(new ErrorHandler("Hospital not found", 404));
  }

  hospital.features.doctors.push({
    name,
    specialty,
    experience,
    referrer,
    qualification,
    contact,
  });

  hospital.updatedBy = req.user?._id;
  await hospital.save();

  res.status(200).json({
    success: true,
    message: "Doctor added successfully",
    hospital,
  });
});

// Remove Doctor from Hospital
export const removeDoctorFromHospital = catchAsyncErrors(async (req, res, next) => {
  const { id, doctorIndex } = req.params;

  let hospital = await Hospital.findById(id);

  if (!hospital) {
    return next(new ErrorHandler("Hospital not found", 404));
  }

  if (doctorIndex < 0 || doctorIndex >= hospital.features.doctors.length) {
    return next(new ErrorHandler("Invalid doctor index", 400));
  }

  hospital.features.doctors.splice(doctorIndex, 1);
  hospital.updatedBy = req.user?._id;
  await hospital.save();

  res.status(200).json({
    success: true,
    message: "Doctor removed successfully",
    hospital,
  });
});

// Get Hospitals by Specialty
export const getHospitalsBySpecialty = catchAsyncErrors(async (req, res, next) => {
  const { specialty } = req.params;

  const hospitals = await Hospital.find({
    "features.specialty": specialty,
    active: true,
    blocked: false,
  });

  res.status(200).json({
    success: true,
    hospitals,
  });
});
