import mongoose from "mongoose";

const capacitySchema = new mongoose.Schema(
  {
    doctorId: {
      type: mongoose.Schema.ObjectId,
      ref: "User",
      required: true,
    },
    serviceDate: {
      type: String, // Stored as YYYY-MM-DD
      required: true,
    },
    capacity: {
      type: Number,
      required: true,
      default: 20,
    },
    isWorkingDay: {
      type: Boolean,
      default: true,
    },
    notes: {
      type: String,
      default: "",
    },
    bookedCount: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

// Ensure a doctor only has one capacity record per date
capacitySchema.index({ doctorId: 1, serviceDate: 1 }, { unique: true });

export const Capacity = mongoose.model("Capacity", capacitySchema);
