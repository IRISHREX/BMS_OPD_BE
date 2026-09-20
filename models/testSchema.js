import mongoose from "mongoose";

const testSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true, required: true },
    category: { type: String, trim: true, default: "General" }, // Blood Test, Imaging, Pathology, Urine Test, Cardiology, Radiology, Biochemistry, Hematology, etc.
  },
  { timestamps: true }
);

testSchema.index({ name: 1 });
testSchema.index({ type: 1 });
testSchema.index({ department: 1 });

export const DiagnosticTest = mongoose.model("DiagnosticTest", testSchema);
