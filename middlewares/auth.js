import { User } from "../models/userSchema.js";
import { catchAsyncErrors } from "./catchAsyncErrors.js";
import ErrorHandler from "./error.js";
import jwt from "jsonwebtoken";

export const isAuthenticatedUser = async (req, res, next) => {
  // Try adminToken first (dashboard cookie), fall back to patientToken
  const token = req.cookies.adminToken || req.cookies.patientToken;
  if (!token) {
    return next(new ErrorHandler("Please login to access this resource", 401));
  }

  try {
    // Use the same secret key used for signing
    const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);
    req.user = await User.findById(decoded.id);

    if (!req.user) return next(new ErrorHandler("User not found", 404));

    next();
  } catch (error) {
    return next(new ErrorHandler("Invalid or expired token", 401));
  }
};


// Middleware to authenticate dashboard users
export const isAdminAuthenticated = catchAsyncErrors(
  async (req, res, next) => {
    const token = req.cookies.adminToken;
    if (!token) {
      return next(
        new ErrorHandler("Dashboard User is not authenticated!", 400)
      );
    }
    const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);
    req.user = await User.findById(decoded.id);
    if (req.user.role !== "Admin") {
      return next(
        new ErrorHandler(`${req.user.role} not authorized for this resource!`, 403)
      );
    }
    next();
  }
);

// Authenticate dashboard token but do not require Admin role
export const isDashboardAuthenticated = catchAsyncErrors(async (req, res, next) => {
  const token = req.cookies.adminToken;
  if (!token) {
    return next(new ErrorHandler('Dashboard User is not authenticated!', 400));
  }
  const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);
  req.user = await User.findById(decoded.id);
  if (!req.user) {
    return next(new ErrorHandler('User not found!', 404));
  }
  // allow any dashboard role (Admin or Doctor) to proceed
  next();
});

// Middleware to authenticate frontend users
export const isPatientAuthenticated = catchAsyncErrors(
  async (req, res, next) => {
    const token = req.cookies.patientToken;
    if (!token) {
      return next(new ErrorHandler("User is not authenticated!", 400));
    }
    const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);
    req.user = await User.findById(decoded.id);
    if (req.user.role !== "Patient") {
      return next(
        new ErrorHandler(`${req.user.role} not authorized for this resource!`, 403)
      );
    }
    next();
  }
);

export const isAuthorized = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return next(
        new ErrorHandler(
          `${req.user.role} not allowed to access this resource!`
        )
      );
    }
    next();
  };
};

export const isAdminOrAssignedDoctorForCompounders = catchAsyncErrors(async (req, res, next) => {
  if (!req.user) {
    return next(new ErrorHandler("User not found!", 404));
  }

  if (req.user.role === "Admin") {
    return next();
  }

  if (req.user.role === "Doctor") {
    req.compounderFilter = { role: "Compounder", assignedDoctors: req.user._id };
    return next();
  }

  return next(
    new ErrorHandler("Only Admins or assigned Doctors can fetch compounders.", 403)
  );
});