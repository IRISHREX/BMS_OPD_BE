import { catchAsyncErrors } from "../middlewares/catchAsyncErrors.js";
import ErrorHandler from "../middlewares/error.js";
import { Capacity } from "../models/capacitySchema.js";

// Set new capacity
export const setCapacity = catchAsyncErrors(async (req, res, next) => {
  const { doctorId, serviceDate, capacity, isWorkingDay, notes } = req.body;

  if (!doctorId || !serviceDate || capacity === undefined) {
    return next(new ErrorHandler("Please provide doctorId, serviceDate and capacity", 400));
  }

  // Find existing capacity for this doctor and date, and update or create
  const existingCapacity = await Capacity.findOne({ doctorId, serviceDate });

  if (existingCapacity) {
    existingCapacity.capacity = capacity;
    if (isWorkingDay !== undefined) existingCapacity.isWorkingDay = isWorkingDay;
    if (notes !== undefined) existingCapacity.notes = notes;
    
    await existingCapacity.save();
    
    return res.status(200).json({
      success: true,
      message: "Capacity updated successfully",
      data: existingCapacity
    });
  }

  // Create new capacity
  const newCapacity = await Capacity.create({
    doctorId,
    serviceDate,
    capacity,
    isWorkingDay: isWorkingDay !== undefined ? isWorkingDay : true,
    notes: notes || ""
  });

  res.status(201).json({
    success: true,
    message: "Capacity set successfully",
    data: newCapacity
  });
});

// Get capacities
export const getCapacities = catchAsyncErrors(async (req, res, next) => {
  const { doctorId, startDate, endDate } = req.query;

  if (!doctorId) {
    return next(new ErrorHandler("Doctor ID is required", 400));
  }

  let filter = { doctorId };

  if (startDate && endDate) {
    filter.serviceDate = {
      $gte: startDate,
      $lte: endDate
    };
  } else if (startDate) {
    filter.serviceDate = { $gte: startDate };
  } else if (endDate) {
    filter.serviceDate = { $lte: endDate };
  }

  const capacities = await Capacity.find(filter).sort({ serviceDate: 1 });

  res.status(200).json({
    success: true,
    data: capacities
  });
});
