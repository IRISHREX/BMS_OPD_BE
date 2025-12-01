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
  if (!composition) {
    return res.status(200).json({ success: true, medicines: [] });
  }

  const compositionTerms = composition.split(',').map(term => term.trim()).filter(Boolean);
  if (compositionTerms.length === 0) {
    return res.status(200).json({ success: true, medicines: [] });
  }
  const regexTerms = compositionTerms.map(term => new RegExp(term, 'i'));

  const medicines = await Medicine.aggregate([
    // Match documents containing at least one of the composition terms
    {
      $match: {
        composition: { $in: regexTerms }
      }
    },
    // Add a field with the number of matches
    {
      $addFields: {
        matches: {
          $size: {
            $filter: {
              input: "$composition",
              as: "comp",
              cond: {
                $or: compositionTerms.map(term => ({
                  $regexMatch: { input: "$$comp", regex: term, options: "i" }
                }))
              }
            }
          }
        }
      }
    },
    // Filter out documents with 0 matches (though the initial $match should prevent this)
    {
      $match: {
        matches: { $gt: 0 }
      }
    },
    // Sort by number of matches
    {
      $sort: { matches: -1 }
    }
  ]);

  res.status(200).json({
    success: true,
    medicines,
  });
});
