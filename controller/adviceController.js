import { catchAsyncErrors } from "../middlewares/catchAsyncErrors.js";
import ErrorHandler from "../middlewares/error.js";
import { Advice } from "../models/adviceSchema.js";

export const DEFAULT_ADVICES = [
  { name: "General Advice", advice: "Drink plenty of water and rest." },
  { name: "Fever Management", advice: "Take paracetamol as prescribed. Monitor temperature." },
  { name: "Diabetes Diet", advice: "Avoid sugary foods. Eat a balanced diet with low glycemic index foods." }
];

export const getAllAdvices = catchAsyncErrors(async (req, res, next) => {
  let count = await Advice.countDocuments();
  if (count === 0) {
    await Advice.insertMany(DEFAULT_ADVICES);
  }

  const { search } = req.query;
  const filter = {};

  if (search) {
    filter.$or = [
      { name: { $regex: search, $options: "i" } },
      { advice: { $regex: search, $options: "i" } },
    ];
  }

  const advices = await Advice.find(filter).sort({ name: 1 });
  res.status(200).json({
    success: true,
    total: advices.length,
    advices,
  });
});

export const createAdvice = catchAsyncErrors(async (req, res, next) => {
  const { name, advice } = req.body;

  if (!name || !name.trim()) {
    return next(new ErrorHandler("Advice name is required!", 400));
  }
  if (!advice || !advice.trim()) {
    return next(new ErrorHandler("Advice text is required!", 400));
  }

  const newAdvice = await Advice.create({
    name: name.trim(),
    advice: advice.trim(),
  });

  res.status(201).json({
    success: true,
    message: "Advice created successfully!",
    advice: newAdvice,
  });
});

export const updateAdvice = catchAsyncErrors(async (req, res, next) => {
  let existingAdvice = await Advice.findById(req.params.id);
  if (!existingAdvice) {
    return next(new ErrorHandler("Advice not found!", 404));
  }

  const updateData = {};
  if (req.body.name) updateData.name = req.body.name.trim();
  if (req.body.advice) updateData.advice = req.body.advice.trim();

  existingAdvice = await Advice.findByIdAndUpdate(req.params.id, updateData, {
    new: true,
    runValidators: true,
  });

  res.status(200).json({
    success: true,
    message: "Advice updated successfully!",
    advice: existingAdvice,
  });
});

export const deleteAdvice = catchAsyncErrors(async (req, res, next) => {
  const advice = await Advice.findById(req.params.id);
  if (!advice) {
    return next(new ErrorHandler("Advice not found!", 404));
  }

  await advice.deleteOne();
  res.status(200).json({
    success: true,
    message: "Advice deleted successfully!",
  });
});
