import mongoose from "mongoose";

const adviceSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true, required: true },
    advice: { type: String, trim: true, required: true },
  },
  { timestamps: true }
);

adviceSchema.index({ name: 1 });

export const Advice = mongoose.model("Advice", adviceSchema);
