import { catchAsyncErrors } from "../middlewares/catchAsyncErrors.js";
import ErrorHandler from "../middlewares/error.js";
import { Message } from '../models/messageSchema.js';
import { User } from '../models/userSchema.js';

export const sendMessage = catchAsyncErrors(async (req, res, next) => {
  const { firstName, lastName, email, phone, message, recipient, recipientEmail } = req.body;
  if (!firstName || !lastName || !email || !phone || !message) {
    return next(new ErrorHandler("Please Fill Full Form!", 400));
  }

  const payload = { firstName, lastName, email, phone, message, sentAt: new Date() };
  
  // If recipient email provided, find user by email
  if (recipientEmail) {
    const recUser = await User.findOne({ email: recipientEmail });
    if (recUser) {
      payload.recipient = recUser._id;
    }
  }
  // If recipient ID provided, validate and attach
  else if (recipient) {
    const recUser = await User.findById(recipient);
    if (recUser) {
      payload.recipient = recUser._id;
    }
  }

  const created = await Message.create(payload);
  // Populate recipient for consistent frontend shape
  await created.populate('recipient');

  res.status(200).json({
    success: true,
    message: "Message Sent!",
    data: created,
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

  // Date filtering
  const { filterOption, customStart, customEnd, email } = req.query;
  if (email) {
    const user = await User.findOne({ email });
    if (user) {
      query.recipient = user._id;
    }
  }
  if (filterOption) {
    const today = new Date();
    const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const endOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);

    if (filterOption === 'Today') {
      query.createdAt = { $gte: startOfToday, $lt: endOfToday };
    } else if (filterOption === 'Old') {
      query.createdAt = { $lt: startOfToday };
    } else if (filterOption === 'Upcoming') {
      query.createdAt = { $gte: endOfToday };
    } else if (filterOption === 'Custom' && customStart && customEnd) {
      query.createdAt = {
        $gte: new Date(customStart),
        $lte: new Date(customEnd),
      };
    }
  }

  let doctors = [];
  // Role-based filtering
  if (req.user.role === 'Admin') {
    doctors = await User.find({ role: 'Doctor' });
    if (req.query.doctorId) {
      query.recipient = req.query.doctorId;
    }
  } else if (req.user.role === 'Doctor') {
    query.recipient = req.user._id;
    doctors = [req.user];
  } else if (req.user.role === 'Compounder') {
    const compounder = await User.findById(req.user._id).populate('assignedDoctors');
    doctors = compounder.assignedDoctors;
    const doctorIds = doctors.map(d => d._id);
    if (req.query.doctorId && doctorIds.map(String).includes(req.query.doctorId)) {
      query.recipient = req.query.doctorId;
    } else {
      query.recipient = { $in: doctorIds };
    }
  } else {
    query.recipient = req.user._id;
  }

  const total = await Message.countDocuments(query);
  const messages = await Message.find(query).populate('recipient').sort({ createdAt: -1 }).skip(skip).limit(limit);

  const readCount = await Message.countDocuments({ ...query, read: true });
  const unreadCount = await Message.countDocuments({ ...query, read: false });

  res.status(200).json({ success: true, messages, total, page, totalPages: Math.ceil(total/limit) || 0, readCount, unreadCount, doctors });
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

export const bulkUpdateMessages = catchAsyncErrors(async (req, res, next) => {
  const { ids, ...payload } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) return next(new ErrorHandler('No ids provided', 400));
  const result = await Message.updateMany({ _id: { $in: ids } }, { $set: payload });
  res.status(200).json({ success: true, updatedCount: result.nModified });
});

export const getMessagesForDoctor = async (req, res, next) => {
  try {
    const doctorId = req.params.id;
    // Populate recipient so frontend can render recipient details (firstName/lastName)
    const messages = await Message.find({ recipient: doctorId }).populate('recipient').sort({ createdAt: -1 });

    // Provide counts and basic pagination metadata similar to getAllMessages
    const total = messages.length;
    const readCount = messages.filter(m => m.read).length;
    const unreadCount = total - readCount;

    res.status(200).json({ success: true, messages, total, page: 1, totalPages: 1, readCount, unreadCount });
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
