import mongoose from "mongoose";

const templateSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  doctorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  margins: {
    top: { type: Number, default: 0 },
    bottom: { type: Number, default: 0 },
    left: { type: Number, default: 0 },
    right: { type: Number, default: 0 },
  },
  fontSize: {
    type: Number,
    default: 10,
  },
  showBorder: {
    type: Boolean,
    default: true,
  },
  headerHeight: {
    type: Number,
    default: 50,
  },
  footerHeight: {
    type: Number,
    default: 15,
  },
  layoutType: {
    type: String,
    enum: [
      "default",
      "single-column",
      "two-column",
      "Template 1: Right-side margin layout",
      "Template 2: Left-side margin layout",
      "Template 3: Orthopedic Layout",
      "right-margin",
      "left-margin",
      "dynamic-json"
    ],
    default: "default",
  },
  visibility: {
    vitals: { type: Boolean, default: true },
    symptoms: { type: Boolean, default: true },
    diagnosis: { type: Boolean, default: true },
    advice: { type: Boolean, default: true },
  },
  isDefault: {
    type: Boolean,
    default: false,
  },
  layoutConfig: {
    type: mongoose.Schema.Types.Mixed,
    default: null,
  }
}, { timestamps: true });

export const Template = mongoose.model("Template", templateSchema);
