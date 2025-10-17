import mongoose from "mongoose";

const invoiceItemSchema = new mongoose.Schema({
  description: { type: String, required: true },
  quantity: { type: Number, required: true, min: 1, default: 1 },
  unitPrice: { type: Number, required: true, min: 0 },
  total: { type: Number, required: true, min: 0 },
});

const paymentSchema = new mongoose.Schema({
  paidAt: { type: Date, default: Date.now },
  amount: { type: Number, required: true, min: 0 },
  method: { type: String, default: "Cash" },
  reference: { type: String },
});

const invoiceSchema = new mongoose.Schema(
  {
    invoiceNumber: { type: String, required: true, unique: true, index: true },
    appointment: { type: mongoose.Schema.Types.ObjectId, ref: "Appointment", index: true },
    patient: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: false },
    doctor: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    items: { type: [invoiceItemSchema], default: [] },
    subtotal: { type: Number, required: true, min: 0, default: 0 },
    tax: { type: Number, min: 0, default: 0 },
    discount: { type: Number, min: 0, default: 0 },
    total: { type: Number, required: true, min: 0, default: 0 },
    status: { type: String, enum: ["Unpaid", "Paid", "Partial", "Cancelled"], default: "Unpaid" },
    issuedAt: { type: Date, default: Date.now },
    dueDate: { type: Date },
    payments: { type: [paymentSchema], default: [] },
  },
  {
    timestamps: true,
  }
);

// Simple pre-save hook to auto-calc totals when items present
invoiceSchema.pre("save", function (next) {
  try {
    const subtotal = (this.items || []).reduce((s, it) => s + (Number(it.total) || 0), 0);
    this.subtotal = subtotal;
    // Ensure total = subtotal + tax - discount
    this.total = Math.max(0, subtotal + (Number(this.tax) || 0) - (Number(this.discount) || 0));
    next();
  } catch (e) {
    next(e);
  }
});

export const Invoice = mongoose.model("Invoice", invoiceSchema);
