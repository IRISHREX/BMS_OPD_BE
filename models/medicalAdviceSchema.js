import mongoose from "mongoose";

const medicalAdviceSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Disease name is required!"],
      trim: true,
    },
    symptoms: {
      type: [String],
      default: [],
    },
    // Structured medicines mapping: used by frontend to pre-fill medicine rows
    medicines: {
      type: [
        {
          name: { type: String, trim: true },
          type: { type: String, trim: true },
          dose: { type: String, trim: true },
          frequency: { type: String, trim: true },
          route: { type: String, trim: true },
          duration: { type: String, trim: true },
          // optional notes or precautions specific to this medicine
          notes: { type: String, trim: true },
        },
      ],
      default: [],
    },
    // Structured test advice rows
    testAdvice: {
      type: [
        {
          testName: { type: String, trim: true },
          testType: { type: String, trim: true },
          precautions: { type: String, trim: true },
          testDate: { type: String, trim: true },
        },
      ],
      default: [],
    },
    // Free-text medication and diet advice (kept for backwards compatibility)
    medication: {
      type: String,
      trim: true,
    },
    diet: {
      type: String,
      trim: true,
    },
    type: {
      type: String,
      trim: true,
    },
    route: {
      type: String,
      trim: true,
    },
    dose: {
      type: String,
      trim: true,
    },
    frequency: {
      type: String,
      trim: true,
    },
    duration: {
      type: String,
      trim: true,
    },
    // Optional aliases and tags to help search and deduplication
    aliases: {
      type: [String],
      default: [],
    },
    tags: {
      type: [String],
      default: [],
    },
    // Optional follow-up suggestion (days or ISO date note)
    followup: {
      days: { type: Number },
      note: { type: String, trim: true },
    },
    desese_description: {
      type: String,
      trim: true,
    },
  },
  { timestamps: true }
);

export const MedicalAdvice = mongoose.model("MedicalAdvice", medicalAdviceSchema);
