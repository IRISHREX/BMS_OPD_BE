import { catchAsyncErrors } from "../middlewares/catchAsyncErrors.js";
import ErrorHandler from "../middlewares/error.js";
import { Medicine } from "../models/medicineSchema.js";

export const addMedicine = catchAsyncErrors(async (req, res, next) => {
  const medicine = await Medicine.create(req.body);
  res.status(201).json({
    success: true,
    medicine,
  });
});

export const getAllMedicines = catchAsyncErrors(async (req, res, next) => {
  const medicines = await Medicine.find();
  res.status(200).json({
    success: true,
    medicines,
  });
});

export const updateMedicine = catchAsyncErrors(async (req, res, next) => {
  let medicine = await Medicine.findById(req.params.id);
  if (!medicine) {
    return next(new ErrorHandler("Medicine not found!", 404));
  }
  medicine = await Medicine.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
    useFindAndModify: false,
  });
  res.status(200).json({
    success: true,
    message: "Medicine Updated!",
    medicine,
  });
});

export const deleteMedicine = catchAsyncErrors(async (req, res, next) => {
  let medicine = await Medicine.findById(req.params.id);
  if (!medicine) {
    return next(new ErrorHandler("Medicine not found!", 404));
  }
  await medicine.deleteOne();
  res.status(200).json({
    success: true,
    message: "Medicine Deleted!",
  });
});

export const searchMedicineByName = catchAsyncErrors(async (req, res, next) => {
  const { name } = req.query;
  const medicines = await Medicine.find({ name: new RegExp(name, 'i') });
  res.status(200).json({
    success: true,
    medicines,
  });
});

export const searchMedicineByComposition = catchAsyncErrors(async (req, res, next) => {
  const { composition } = req.query;
  const medicines = await Medicine.aggregate([
    { $unwind: "$composition" },
    { $match: { composition: new RegExp(composition, 'i') } },
    { $group: { _id: "$_id", name: { $first: "$name" }, composition: { $push: "$composition" }, matches: { $sum: 1 } } },
    { $sort: { matches: -1 } }
  ]);
  res.status(200).json({
    success: true,
    medicines,
  });
});
