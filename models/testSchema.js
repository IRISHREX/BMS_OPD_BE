import mongoose from "mongoose";

const testSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true, required: true },
    category: { type: String, trim: true, default: "General" }, // Blood Test, Imaging, Pathology, Urine Test, Cardiology, Radiology, Biochemistry, Hematology, etc.
  },
  { timestamps: true }
);

export const DiagnosticTest = mongoose.model("DiagnosticTest", testSchema);
