import mongoose from "mongoose";

const testSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true, required: true },
    type: { type: String, trim: true, default: "General" }, // Blood Test, Imaging, Pathology, Urine, Cardiology, Radiology, etc.
    precautions: { type: String, trim: true, default: "" }, // e.g., "Fasting 8-10 hours", "Remove metal objects", "None"
    department: { type: String, trim: true, default: "" },
    description: { type: String, trim: true, default: "" },
    normalRange: { type: String, trim: true, default: "" },
    price: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export const DiagnosticTest = mongoose.model("DiagnosticTest", testSchema);
