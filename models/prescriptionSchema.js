import mongoose from "mongoose";

const prescriptionSchema = new mongoose.Schema({
  patientId: {
    type: mongoose.Schema.ObjectId,
    ref: "User",
    required: [true, "Patient ID is required"]
  },
  doctorId: {
    type: mongoose.Schema.ObjectId,
    ref: "User",
    required: [true, "Doctor ID is required"]
  },
  appointmentId: {
    type: mongoose.Schema.ObjectId,
    ref: "Appointment"
  },
  presentingComplaints: { type: String, default: "" },
  medicalHistory: { type: String, default: "" },
  clinicalFindings: { type: mongoose.Schema.Types.Mixed, default: {} },
  diagnosys_heading: { type: String, default: "Provisional Diagnosis" },
  provisionalDiagnosis: { type: mongoose.Schema.Types.Mixed, default: "" },
  pathologyReport: { type: String, default: "" },
  radiologyReport: { type: String, default: "" },
  femaleTests: {
    Gravida: { type: String, default: "" },
    Parity: { type: String, default: "" },
    LMP: { type: String, default: "" },
    EDD: { type: String, default: "" },
    POG: { type: String, default: "" },
    LCB: { type: String, default: "" },
    MOD: { type: String, default: "" },
  },
  vitals: {
    BP: { type: String, default: "" },
    PR: { type: String, default: "" },
    SPO2: { type: String, default: "" },
    Temp: { type: String, default: "" },
    Height: { type: String, default: "" },
    Weight: { type: String, default: "" },
    BMI: { type: String, default: "" },
    Others: { type: String, default: "" },
  },
  medicines: {
    type: [
      {
        name: { type: String },
        type: { type: String },
        dose: { type: String },
        frequency: { type: String },
        route: { type: String },
        duration: { type: String },
        notes: { type: String },
        instruction: { type: String },
      },
    ],
    default: [],
  },
  advice: {
    testAdvice: { type: Array, default: [] },
    medication: { type: String, default: "" },
    diet: { type: String, default: "" },
  },
  additionalAdvice: { type: String, default: "" },
  followUp: { type: String, default: "" },
}, { timestamps: true });

export const Prescription = mongoose.model("Prescription", prescriptionSchema);
