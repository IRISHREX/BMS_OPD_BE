import mongoose from "mongoose";
import validator from "validator";

const messageSchema = new mongoose.Schema({
  firstName: {
    type: String,
    required: true,
    minLength: [1, "First Name Must Contain At Least 1 Character!"],
  },
  lastName: {
    type: String,
    required: false,
    default: "",
  },
  email: {
    type: String,
    required: true,
    validate: [validator.isEmail, "Provide A Valid Email!"],
  },
  phone: {
    type: String,
    required: true,
    minLength: [10, "Phone Number Must Contain Exact 10 Digits!"],
    maxLength: [11, "Phone Number Must Contain Exact 11 Digits!"],
  },
  message: {
    type: String,
    required: true,
    minLength: [10, "Message Must Contain At Least 10 Characters!"],
  },
  // admin metadata
  read: {
    type: Boolean,
    default: false,
  },
  markedForDeletion: {
    type: Boolean,
    default: false,
  },
  sentAt: {
    type: Date,
    default: Date.now,
  },
  recipient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
 
}, { timestamps: true });

export const Message = mongoose.model("Message", messageSchema);
