
import mongoose from "mongoose";

const medicineSchema = new mongoose.Schema({
  name: { type: String, trim: true, required: true },
  composition: [{ type: String }],
  type: { type: String, trim: true },
  dose: { type: String, trim: true },
  frequency: { type: String, trim: true },
  route: { type: String, trim: true },
  duration: { type: String, trim: true },
  notes: { type: String, trim: true },
});

export const Medicine = mongoose.model("Medicine", medicineSchema);
