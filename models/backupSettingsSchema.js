import mongoose from "mongoose";

const backupSettingsSchema = new mongoose.Schema(
  {
    storageLimitMB: {
      type: Number,
      default: 1024, // 1 GB default
    },
    appointmentThreshold: {
      type: Number,
      default: 1000, // 1000 appointments default
    },
    lastBackupDate: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

export const BackupSettings = mongoose.model("BackupSettings", backupSettingsSchema);
