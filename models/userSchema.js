import mongoose from "mongoose";
import validator from "validator";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const userSchema = new mongoose.Schema({
  firstName: {
    type: String,
    required: [true, "First Name Is Required!"],
    minLength: [3, "First Name Must Contain At Least 3 Characters!"],
  },
  lastName: {
    type: String,
    required: [true, "Last Name Is Required!"],
    minLength: [3, "Last Name Must Contain At Least 3 Characters!"],
  },
  name:{
    type: String,
  },
  email: {
    type: String,
    // required: [true, "Email Is Required!"],
    validate: [validator.isEmail, "Provide A Valid Email!"],
  },
  qualifications:{
    type: String,
  },
  // Doctor avatar (profile), sign image, optional header image
  // Stored as URLs pointing to the image cache endpoints
  docAvatar: { type: String, default: null },
  signImage: { type: String, default: null },
  headerImage: { type: String, default: null },
  age: {
    type: Number,
    min: 0,
  },
  phone: {
    type: String,
    // required: [true, "Phone Is Required!"],
    minLength: [10, "Phone Number Must Contain Exact 10 Digits!"],
    maxLength: [11, "Phone Number Must Contain Exact 10 Digits!"],
  },
  nic: {
    type: String,
  },
  dob: {
    type: Date,
    // required: [true, "DOB Is Required!"],
  },
  gender: {
    type: String,
    // required: [true, "Gender Is Required!"],
    enum: ["Male", "Female", "Others"],
  },
  password: {
    type: String,
    // required: [true, "Password Is Required!"],
    minLength: [8, "Password Must Contain At Least 8 Characters!"],
    select: false,
  },
  role: {
    type: String,
    required: [true, "User Role Required!"],
    enum: ["Patient", "Doctor", "Admin", "Compounder"],
  },
  doctorDepartment:{
    type: String,
  },
  // consultation fee for doctors
  consultationFee: {
    type: Number,
    default: 100,
  },
  // If this user is a Doctor, store assigned compounder user ids
  compounders: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  // If this user is a Compounder, store assigned doctor ids
  assignedDoctors: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
});

userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) {
    return next();
  }

  // Only hash the password when it has been modified (or is new).
  this.password = await bcrypt.hash(this.password, 10);
});

userSchema.methods.comparePassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

userSchema.methods.generateJsonWebToken = function () {
  return jwt.sign({ id: this._id }, process.env.JWT_SECRET_KEY, {
    expiresIn: process.env.JWT_EXPIRES || "7d",
    
  });
};

export const User = mongoose.model("User", userSchema);
