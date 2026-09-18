import mongoose from "mongoose";

const logSchema = new mongoose.Schema(
  {
    level: {
      type: String,
      enum: ["INFO", "WARN", "ERROR", "SUCCESS"],
      default: "INFO",
      index: true,
    },
    category: {
      type: String,
      enum: [
        "Auth",
        "Appointment",
        "Backup",
        "Template",
        "User",
        "System",
        "Billing",
        "Referral",
        "Settings",
      ],
      default: "System",
      index: true,
    },
    action: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    message: {
      type: String,
      required: true,
      trim: true,
    },
    user: {
      id: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      name: { type: String, default: "System" },
      role: { type: String, default: "System" },
      email: { type: String },
    },
    ip: {
      type: String,
      default: "-",
    },
    method: {
      type: String,
      default: "-",
    },
    url: {
      type: String,
      default: "-",
    },
    statusCode: {
      type: Number,
      default: 200,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

// Index for efficient sorting and filtering
logSchema.index({ createdAt: -1, level: 1 });
logSchema.index({ createdAt: -1, category: 1 });

export const Log = mongoose.model("Log", logSchema);
