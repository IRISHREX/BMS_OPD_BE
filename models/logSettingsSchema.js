import mongoose from "mongoose";

const logSettingsSchema = new mongoose.Schema(
  {
    maxLogsLimit: {
      type: Number,
      default: 500,
      min: 50,
      max: 10000,
    },
    autoDeleteEnabled: {
      type: Boolean,
      default: true,
    },
    lastDownloadDate: {
      type: Date,
      default: null,
    },
    alertFrequencyDays: {
      type: Number,
      default: 7,
    },
  },
  {
    timestamps: true,
  }
);

export const LogSettings = mongoose.model("LogSettings", logSettingsSchema);
