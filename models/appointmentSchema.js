import mongoose from "mongoose";
import { Mongoose } from "mongoose";
import validator from "validator";

const appointmentSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, "Patient Name Is Required!"],
    minLength: [3, "Name Must Contain At Least 3 Characters!"],
  },
  email: {
    type: String,
    required: false,
    // validate: [v => !v || validator.isEmail(v), "Provide A Valid Email!"],
    default: "SohelJavadeveloper@gmail.com",
  },
  age: {
    type: Number,
    min: 0,
  },
  phone: {
    type: String,
    required: [true, "Phone Is Required!"],
    minLength: [10, "Phone Number Must Contain Exact 10 Digits!"],
    maxLength: [10, "Phone Number Must Contain Exact 10 Digits!"],
  },
  nic: {
    type: String,
    required: false,
    minLength: [13, "NIC Must Contain Only 13 Digits!"],
    maxLength: [13, "NIC Must Contain Only 13 Digits!"],
  },
  dob: {
    type: Date,
    required: false,
  },
  gender: {
    type: String,
    required: [true, "Gender Is Required!"],
    enum: ["Male", "Female"],
  },
  appointment_date: {
    type: String,
    required: [true, "Appointment Date Is Required!"],
    default: new Date().toISOString(),
  },
  department: {
    type: String,
    required: [true, "Department Name Is Required!"],
  },
  doctor: {
    firstName: {
      type: String,
      required: [true, "Doctor Name Is Required!"],
    },
    lastName: {
      type: String,
      required: [true, "Doctor Name Is Required!"],
    },
  },
  hasVisited: {
    type: Boolean,
    default: false,
  },
  result: {
    type: [
      {
        initialComplain: { type: String },
        medicalHistory: { type: String },
        diagnosys: {
          BP: { type: String },
          Diabetics: { type: String },
          SPO2: { type: String },
          Height: { type: String },
          Weight: { type: String },
          Others: { type: String },
        },
        medicineAdvice: {
          type: [
            {
              name: { type: String },
              type: { type: String },
              dose: { type: String },
              frequency: { type: String },
              route: { type: String },
              duration: { type: String },
            },
          ],
          default: [],
        },
          advice: {
            type: Object,
            default: () => ({ types: [], custom: [] })
          },
      },
    ],
    default: [],
  },
  address: {
    type: String,
    required: [true, "Address Is Required!"],
  },
  // price and payment status for appointments
  price: {
    type: Number,
    default: 0,
  },
  paymentStatus: {
    type: String,
    enum: ["Pending", "Accepted"],
    default: "Pending",
  },
  doctorId: {
    type: mongoose.Schema.ObjectId,
    required: [true, "Doctor Id Is Invalid!"],
    default:"68d4af0bd840a75e16364029",
  },
  patientId: {
    type: mongoose.Schema.ObjectId,
    ref: "User",
  },
  status: {
    type: String,
    enum: ["Pending", "Accepted", "Rejected","Completed"],
    default: "Pending",
  },
});

export const Appointment = mongoose.model("Appointment", appointmentSchema);
