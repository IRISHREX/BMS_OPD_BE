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
    maxLength: [11, "Phone Number Must Contain Exact 11 Digits!"],
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
    enum: ["Male", "Female", "Others"],
  },
  appointment_date: {
    type: String,
    required: [true, "Appointment Date Is Required!"],
    default: new Date().toISOString(),
  },
  followup_date: {
    type: String,
    required: false,
    default: null,
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
  booked_by: {
    type: mongoose.Schema.ObjectId,
    ref: "User",
  },
  book_by_name: {
    type: String,
    default: ''
  },

  // Clinical Findings & Diagnosis
  clinicalFindings: { type: String },
  provisionalDiagnosis: {
    type: {
      type: String,
      enum: ["Provisional Diagnosis", "Diagnosis", "Differential Diagnosis"],
      default: "Provisional Diagnosis"
    },
    value: { type: String }
  },


  result: {
    type: [
      {
        initialComplain: { type: String },
        presentingComplaints: { type: String },
        medicalHistory: { type: String },
        clinical_findings: { type: String },
        diagnosys_heading: { type: String },

        diagnosys: {
          BP: { type: String },
          PR: { type: String },
          SPO2: { type: String },
          Temp: { type: String },
          Height: { type: String },
          Weight: { type: String },
          BMI: { type: String },
          Others: { type: String },
        },

        Gravida: { type: String },
        Parity: {
          type: String, // Parity Type (e.g., G1P0, G2P1)
        },
        LMP: { type: String },
        EDD: { type: String },
        POG: { type: String },
        LCB: { type: String }, // Last Child Born
        MOD: { type: String }, // Mode of Delivery

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
          testAdvice: { type: Array, default: [] },
          medication: { type: String },
          diet: { type: String },
        },
        followUp: { type: String },
      },
    ],
    default: [],
  },
  address: {
    type: String,
    required: [true, "Address Is Required!"],
  },
  profession: {
    type: String,
    required: false,
  },
  // price and payment status for appointments
  price: {
    type: Number,
    default: 0,
  },
  paymentStatus: {
    type: String,
    // Added 'Due' to represent payment outstanding. Values: Pending (unknown), Accepted (recorded/acknowledged), Due (payment outstanding), Paid (paid)
    enum: ["Pending", "Accepted", "Due", "Paid"],
    default: "Pending",
  },
  doctorId: {
    type: mongoose.Schema.ObjectId,
    required: [true, "Doctor Id Is Invalid!"],
    default: "68d4af0bd840a75e16364029",
  },
  patientId: {
    type: mongoose.Schema.ObjectId,
    ref: "User",
  },
  invoices: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Invoice' }],
  status: {
    type: String,
    enum: ["Pending", "Accepted", "Rejected", "Completed"],
    default: "Pending",
  },
});

export const Appointment = mongoose.model("Appointment", appointmentSchema);
