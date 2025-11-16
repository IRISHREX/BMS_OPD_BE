import mongoose from 'mongoose';

const doctorImageSchema = new mongoose.Schema({
  doctor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  purpose: { type: String, enum: ['avatar', 'sign', 'header'], required: true },
  filename: { type: String },
  contentType: { type: String },
  size: { type: Number },
  data: { type: Buffer },
  createdAt: { type: Date, default: Date.now },
});

export const DoctorImage = mongoose.model('DoctorImage', doctorImageSchema);
