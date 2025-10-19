import mongoose from 'mongoose';

const reportSchema = new mongoose.Schema({
  appointmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Appointment', required: true, unique: true, index: true },
  doctorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  appointmentDate: { type: Date },
  amount: { type: Number, default: 0 }, // total amount considered (invoice.total or appointment.price fallback)
  // New keys: 'paid' and 'due' - paid represents amounts considered received/marked paid
  paid: { type: Number, default: 0 },
  due: { type: Number, default: 0 }, // amount marked as due/receivable
  // For backward compatibility keep 'revenue' as alias of 'paid' (synchronised by controller)
  revenue: { type: Number, default: 0 }, // deprecated alias for paid
  status: { type: String, enum: ['Due', 'Paid', 'Partial', 'Adjusted'], default: 'Due' },
  notes: { type: String },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

export const Report = mongoose.model('Report', reportSchema);
