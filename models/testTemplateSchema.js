import mongoose from "mongoose";

const testItemSchema = new mongoose.Schema({
  testName: { type: String, trim: true, required: true },
  testType: { type: String, trim: true, default: "" },
  precautions: { type: String, trim: true, default: "" },
  testDate: { type: String, trim: true, default: "" },
});

const testTemplateSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true, required: true },
    category: { type: String, trim: true, default: "General Profile" }, // e.g. Fever, Diabetes, Cardiology, Orthopedic, Routine, Pre-Op
    description: { type: String, trim: true, default: "" },
    tests: [testItemSchema],
    tags: [{ type: String, trim: true }],
    isDefault: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export const TestTemplate = mongoose.model("TestTemplate", testTemplateSchema);
