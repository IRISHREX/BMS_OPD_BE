import { catchAsyncErrors } from "../middlewares/catchAsyncErrors.js";
import ErrorHandler from "../middlewares/error.js";
import { Message } from '../models/messageSchema.js';

export const sendMessage = catchAsyncErrors(async (req, res, next) => {
  const { firstName, lastName, email, phone, message } = req.body;
  if (!firstName || !lastName || !email || !phone || !message) {
    return next(new ErrorHandler("Please Fill Full Form!", 400));
  }
  await Message.create({ firstName, lastName, email, phone, message, sentAt: new Date() });
  res.status(200).json({
    success: true,
    message: "Message Sent!",
  });
});

export const getAllMessages = catchAsyncErrors(async (req, res, next) => {
  // support pagination and simple filters
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 10;
  const skip = (page - 1) * limit;

  const query = {};
  if (req.query.q) {
    const r = new RegExp(req.query.q, 'i');
    query.$or = [ { message: r }, { email: r }, { phone: r } ];
  }

  const total = await Message.countDocuments(query);
  const messages = await Message.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit);

  const readCount = await Message.countDocuments({ ...query, read: true });
  const unreadCount = await Message.countDocuments({ ...query, read: false });

  res.status(200).json({ success: true, messages, total, page, totalPages: Math.ceil(total/limit) || 0, readCount, unreadCount });
});

export const updateMessage = catchAsyncErrors(async (req, res, next) => {
  const { id } = req.params;
  const payload = { ...req.body };
  const updated = await Message.findByIdAndUpdate(id, payload, { new: true });
  if (!updated) return next(new ErrorHandler('Message not found', 404));
  res.status(200).json({ success: true, message: 'Updated', data: updated });
});

export const deleteMessageById = catchAsyncErrors(async (req, res, next) => {
  const { id } = req.params;
  const m = await Message.findById(id);
  if (!m) return next(new ErrorHandler('Message not found', 404));
  await m.deleteOne();
  res.status(200).json({ success: true, message: 'Deleted' });
});

export const bulkDeleteMessages = catchAsyncErrors(async (req, res, next) => {
  const ids = req.body?.ids;
  if (!Array.isArray(ids) || ids.length === 0) return next(new ErrorHandler('No ids provided', 400));
  const result = await Message.deleteMany({ _id: { $in: ids } });
  res.status(200).json({ success: true, deletedCount: result.deletedCount });
});
export const getMessagesForDoctor = async (req, res, next) => {
  try {
    const doctorId = req.params.id;
    const messages = await Message.find({ recipient: doctorId }).sort({ createdAt: -1 });
    res.status(200).json({ success: true, messages });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch messages' });
  }
};
export const searchMessages = catchAsyncErrors(async (req, res, next) => {
  const { q } = req.query;
  if (!q) return res.status(200).json({ success: true, messages: [] });
  const r = new RegExp(q, 'i');
  const messages = await Message.find({ $or: [ { message: r }, { email: r }, { phone: r } ] }).sort({ createdAt: -1 });
  res.status(200).json({ success: true, messages });
});
