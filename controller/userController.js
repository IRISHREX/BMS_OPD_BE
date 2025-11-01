
import { catchAsyncErrors } from "../middlewares/catchAsyncErrors.js";
import { User } from "../models/userSchema.js";
import ErrorHandler from "../middlewares/error.js";
import { generateToken } from "../utils/jwtToken.js";
import cloudinary from "cloudinary";

export const patientRegister = catchAsyncErrors(async (req, res, next) => {
  const { firstName, lastName, email, phone, nic, dob, gender, password } =
    req.body;
  if (
    !firstName ||
    !lastName ||
    !email ||
    !phone ||
    !nic ||
    !dob ||
    !gender ||
    !password
  ) {
    return next(new ErrorHandler("Please Fill Full Form!", 400));
  }

  const isRegistered = await User.findOne({ email });
  if (isRegistered) {
    return next(new ErrorHandler("User already Registered!", 400));
  }

  const user = await User.create({
    firstName,
    lastName,
    email,
    phone,
    nic,
    dob,
    gender,
    password,
    role: "Patient",
  });
  generateToken(user, "User Registered!", 200, res);
});

export const login = catchAsyncErrors(async (req, res, next) => {
  const { email, password, role } = req.body;
  console.log('Login attempt:', { email, role });
  if (!email || !password || !role) {
    return next(new ErrorHandler("Please Fill Email, Password and Role!", 400));
  }
  const user = await User.findOne({ email }).select("+password");
  console.log('Found user:', user);
  if (!user) {
    return next(new ErrorHandler("Invalid Email Or Password!", 400));
  }

  const isPasswordMatch = await user.comparePassword(password);
  if (!isPasswordMatch) {
    return next(new ErrorHandler("Invalid Email Or Password!", 400));
  }
  if (role !== user.role) {
    return next(new ErrorHandler(`User Not Found With This Role!`, 400));
  }
  generateToken(user, "Login Successfully!", 201, res);
});
// Get all compounders
export const getAllCompounders = catchAsyncErrors(async (req, res, next) => {
  const compounders = await User.find({ role: 'Compounder' }).populate(
    "assignedDoctors",
    "firstName lastName"
  );
  res.status(200).json({ success: true, compounders });
});
export const addNewAdmin = catchAsyncErrors(async (req, res, next) => {
  const { firstName, lastName, email, phone, nic, dob, gender, password, role, assignedDoctors } = req.body;

  if (!firstName || !lastName || !email || !phone || !nic || !dob || !gender || !password) {
    return next(new ErrorHandler("Please Fill Full Form!", 400));
  }

  const isRegistered = await User.findOne({ email });
  if (isRegistered) {
    return next(new ErrorHandler("User With This Email Already Exists!", 400));
  }

  // If creating a compounder, validate assignedDoctors and then create compounder and link to doctors
  if (role === 'Compounder') {
    // assignedDoctors must be an array of doctor IDs (optional)
    let doctorIds = Array.isArray(assignedDoctors) ? assignedDoctors : [];

    // Validate doctors exist and have role Doctor
    if (doctorIds.length > 0) {
      const doctors = await User.find({ _id: { $in: doctorIds }, role: 'Doctor' });
      if (doctors.length !== doctorIds.length) {
        return next(new ErrorHandler('One or more assignedDoctors are invalid', 400));
      }
    }

    const compounder = await User.create({
      firstName,
      lastName,
      email,
      phone,
      nic,
      dob,
      gender,
      password,
      role: 'Compounder',
      assignedDoctors: doctorIds,
    });

    // Update each doctor to include this compounder in their compounders list
    if (doctorIds.length > 0) {
      await User.updateMany(
        { _id: { $in: doctorIds } },
        { $addToSet: { compounders: compounder._id } }
      );
    }

    return res.status(200).json({ success: true, message: 'New Compounder Registered', compounder });
  }

  // Default: create Admin
  const admin = await User.create({
    firstName,
    lastName,
    email,
    phone,
    nic,
    dob,
    gender,
    password,
    role: 'Admin',
  });
  res.status(200).json({ success: true, message: 'New Admin Registered', admin });
});

// Dedicated compounder creation handler (for dashboard users: Admins and Doctors)
export const addNewCompounder = catchAsyncErrors(async (req, res, next) => {
  const { firstName, lastName, email, phone, nic, dob, gender, password, assignedDoctors } = req.body;

  if (!firstName || !lastName || !email || !phone || !nic || !dob || !gender || !password) {
    return next(new ErrorHandler('Please Fill Full Form!', 400));
  }

  const isRegistered = await User.findOne({ email });
  if (isRegistered) {
    return next(new ErrorHandler('User With This Email Already Exists!', 400));
  }

  let doctorIds = Array.isArray(assignedDoctors) ? assignedDoctors : [];
  // If requester is a Doctor (non-Admin), they may only assign the compounder to themselves
  const requester = req.user;
  if (requester && requester.role === 'Doctor') {
    // Only allow assignment to the requesting doctor
    doctorIds = [requester._id.toString()];
  }
  if (doctorIds.length > 0) {
    const doctors = await User.find({ _id: { $in: doctorIds }, role: 'Doctor' });
    if (doctors.length !== doctorIds.length) {
      return next(new ErrorHandler('One or more assignedDoctors are invalid', 400));
    }
  }

  const compounder = await User.create({ firstName, lastName, email, phone, nic, dob, gender, password, role: 'Compounder', assignedDoctors: doctorIds });

  if (doctorIds.length > 0) {
    await User.updateMany({ _id: { $in: doctorIds } }, { $addToSet: { compounders: compounder._id } });
  }

  res.status(200).json({ success: true, message: 'New Compounder Registered', compounder });
});

// Admin-only: list all users with roles (for Role Settings UI)
export const getAllUsers = catchAsyncErrors(async (req, res, next) => {
  const users = await User.find({}, { password: 0 }).sort({ role: 1, firstName: 1 });
  res.status(200).json({ success: true, users });
});

// Admin-only: update a user's role (and clean up role-specific fields as needed)
export const updateUserRole = catchAsyncErrors(async (req, res, next) => {
  const { id } = req.params;
  const { role } = req.body;
  const allowedRoles = ['Admin', 'Doctor', 'Compounder', 'Patient'];
  if (!allowedRoles.includes(role)) {
    return next(new ErrorHandler('Invalid role specified', 400));
  }
  const user = await User.findById(id);
  if (!user) return next(new ErrorHandler('User not found', 404));

  // If demoting a Doctor, remove any compounders reference from doctors list
  if (user.role === 'Doctor' && role !== 'Doctor') {
    await User.updateMany({ compounders: user._id }, { $pull: { compounders: user._id } });
  }

  // If changing to Doctor, ensure doctor-specific fields exist (no-op here but placeholder)
  user.role = role;
  await user.save();
  res.status(200).json({ success: true, message: 'User role updated', user });
});

  // Update user by ID (Admin only)
  export const updateUserById = catchAsyncErrors(async (req, res, next) => {
    const { id } = req.params;
    const updateData = req.body;
    const user = await User.findByIdAndUpdate(id, updateData, { new: true, runValidators: true });
    if (!user) return next(new ErrorHandler('User not found', 404));
    res.status(200).json({ success: true, message: 'User updated successfully', user });
  });

  // Delete user by ID (Admin only)
    export const deleteUserById = catchAsyncErrors(async (req, res, next) => {
      const { id } = req.params;
      const user = await User.findByIdAndDelete(id);
      if (!user) return next(new ErrorHandler('User not found', 404));
      // If user is a patient, delete all their appointments
      if (user.role === 'Patient') {
        await Appointment.deleteMany({ patientId: user._id });
      }
      res.status(200).json({ success: true, message: 'User deleted successfully' });
    });

export const addNewDoctor = catchAsyncErrors(async (req, res, next) => {
  // if (!req.files || Object.keys(req.files).length === 0) {
  //   return next(new ErrorHandler("Doctor Avatar Required!", 400));
  // }
  // const { docAvatar } = req.files;
  // const allowedFormats = ["image/png", "image/jpeg", "image/webp"];
  // if (!allowedFormats.includes(docAvatar.mimetype)) {
  //   return next(new ErrorHandler("File Format Not Supported!", 400));
  // }
  const {
    firstName,
    lastName,
    email,
    phone,
    nic,
    dob,
    gender,
    password,
    doctorDepartment,
  } = req.body;
  if (
    !firstName ||
    !lastName ||
    !email ||
    !phone ||
    !nic ||
    !dob ||
    !gender ||
    !password ||
    !doctorDepartment 
    // ||
    // !docAvatar
  ) {
    return next(new ErrorHandler("Please Fill Full Form!", 400));
  }
  const isRegistered = await User.findOne({ email });
  if (isRegistered) {
    return next(
      new ErrorHandler("Doctor With This Email Already Exists!", 400)
    );
  }
  // const cloudinaryResponse = await cloudinary.uploader.upload(
  //   docAvatar.tempFilePath
  // );
  // if (!cloudinaryResponse || cloudinaryResponse.error) {
  //   console.error(
  //     "Cloudinary Error:",
  //     cloudinaryResponse.error || "Unknown Cloudinary error"
  //   );
  //   return next(
  //     new ErrorHandler("Failed To Upload Doctor Avatar To Cloudinary", 500)
  //   );
  // }
  const doctor = await User.create({
    firstName,
    lastName,
    email,
    phone,
    nic,
    dob,
    gender,
    password,
    role: "Doctor",
    doctorDepartment,
    // docAvatar: {
    //   public_id: cloudinaryResponse.public_id,
    //   url: cloudinaryResponse.secure_url,
    // },
  });
  res.status(200).json({
    success: true,
    message: "New Doctor Registered",
    doctor,
  });
});

export const getAllDoctors = catchAsyncErrors(async (req, res, next) => {
  const doctors = await User.find({ role: 'Doctor' }).populate({ path: 'compounders', select: 'firstName lastName email' });
  res.status(200).json({ success: true, doctors });
});

  // Search doctors by name, phone, department, or NIC using regex
  export const searchDoctor = catchAsyncErrors(async (req, res, next) => {
    const { query } = req.query;
    if (!query) {
      return next(new ErrorHandler('Search query required', 400));
    }
    // Build regex for case-insensitive partial match
    const regex = new RegExp(query, 'i');
    const doctors = await User.find({
      role: 'Doctor',
      $or: [
        { firstName: regex },
        { lastName: regex },
        { phone: regex },
        { doctorDepartment: regex },
        { nic: regex }
      ]
    });
    res.status(200).json({ success: true, doctors });
  });

// Get patient by ID
export const getPatientById = catchAsyncErrors(async (req, res, next) => {
  const { id } = req.params;
  const patient = await User.findOne({ _id: id, role: "Patient" });
  if (!patient) {
    return next(new ErrorHandler("Patient not found!", 404));
  }
  res.status(200).json({
    success: true,
    patient,
  });
});

// Get patient by name or phone (query params: name, phone)
export const getPatientByNameOrPhone = catchAsyncErrors(async (req, res, next) => {
  const { name, phone } = req.query;
  let query = { role: "Patient" };
  if (name) {
    // Search by first or last name (case-insensitive)
    query.$or = [
      { firstName: { $regex: name, $options: "i" } },
      { lastName: { $regex: name, $options: "i" } }
    ];
  }
  if (phone) {
    query.phone = phone;
  }
  const patients = await User.find(query);
  if (!patients || patients.length === 0) {
    return next(new ErrorHandler("Patient not found!", 404));
  }
  res.status(200).json({
    success: true,
    patients,
  });
});

// Update patient by ID
export const updatePatientById = catchAsyncErrors(async (req, res, next) => {
  const { id } = req.params;
  let patient = await User.findOne({ _id: id, role: "Patient" });
  if (!patient) {
    return next(new ErrorHandler("Patient not found!", 404));
  }
  patient = await User.findByIdAndUpdate(id, req.body, {
    new: true,
    runValidators: true,
    useFindAndModify: false,
  });
  res.status(200).json({
    success: true,
    patient,
    message: "Patient updated successfully!",
  });
});

// Get doctor by ID
export const getDoctorById = catchAsyncErrors(async (req, res, next) => {
  const { id } = req.params;
  const doctor = await User.findOne({ _id: id, role: "Doctor" });
  if (!doctor) {
    return next(new ErrorHandler("Doctor not found!", 404));
  }
  res.status(200).json({
    success: true,
    doctor,
  });
});

// Get list of doctors (id and name) for selection
export const getDoctorsList = catchAsyncErrors(async (req, res, next) => {
  const doctors = await User.find({ role: "Doctor" }, { firstName: 1, lastName: 1 });
  const list = doctors.map(d => ({ id: d._id, name: `${d.firstName} ${d.lastName}` }));
  res.status(200).json({ success: true, doctors: list });
});

export const getUserDetails = catchAsyncErrors(async (req, res, next) => {
  const user = req.user;
  res.status(200).json({
    success: true,
    user,
  });
});

// Return currently authenticated doctor (requires dashboard token and role Doctor)
export const getDoctorMe = catchAsyncErrors(async (req, res, next) => {
  const user = req.user;
  if (!user) return next(new ErrorHandler('User not found', 404));
  if (user.role !== 'Doctor') return next(new ErrorHandler('Not a doctor', 403));
  res.status(200).json({ success: true, doctor: user });
});

// Return dashboard user (Admin or Doctor)
export const getDashboardMe = catchAsyncErrors(async (req, res, next) => {
  const user = req.user;
  console.log('Dashboard user:', user);
  if (!user) return next(new ErrorHandler('User not found', 404));
  res.status(200).json({ success: true, user });
});

// Logout function for dashboard admin
export const logoutAdmin = catchAsyncErrors(async (req, res, next) => {
  res
    .status(201)
    .cookie("adminToken", "", {
      httpOnly: true,
      expires: new Date(Date.now()),
    })
    .json({
      success: true,
      message: "Admin Logged Out Successfully.",
    });
});

// Logout function for frontend patient
export const logoutPatient = catchAsyncErrors(async (req, res, next) => {
  res
    .status(201)
    .cookie("patientToken", "", {
      httpOnly: true,
      expires: new Date(Date.now()),
    })
    .json({
      success: true,
      message: "Patient Logged Out Successfully.",
    });
});
