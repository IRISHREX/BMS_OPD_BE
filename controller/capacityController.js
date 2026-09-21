import { catchAsyncErrors } from "../middlewares/catchAsyncErrors.js";
import ErrorHandler from "../middlewares/error.js";
import { Capacity } from "../models/capacitySchema.js";
import mongoose from "mongoose";

// Set new or update existing capacity
export const setCapacity = catchAsyncErrors(async (req, res, next) => {
  let { doctorId, serviceDate, capacity, maxPatients, date, isWorkingDay, notes } = req.body;

  doctorId = doctorId || req.user?._id;
  serviceDate = serviceDate || date;
  if (capacity === undefined && maxPatients !== undefined) {
    capacity = maxPatients;
  }

  if (!doctorId || !serviceDate || capacity === undefined) {
    return next(new ErrorHandler("Please provide doctorId, serviceDate and capacity", 400));
  }

  // Find existing capacity for this doctor and date, and update or create
  const existingCapacity = await Capacity.findOne({ doctorId, serviceDate });

  if (existingCapacity) {
    existingCapacity.capacity = Number(capacity);
    if (isWorkingDay !== undefined) existingCapacity.isWorkingDay = isWorkingDay;
    if (notes !== undefined) existingCapacity.notes = notes;
    
    await existingCapacity.save();
    
    return res.status(200).json({
      success: true,
      message: "Capacity updated successfully",
      data: existingCapacity,
      capacity: existingCapacity,
    });
  }

  // Create new capacity
  const newCapacity = await Capacity.create({
    doctorId,
    serviceDate,
    capacity: Number(capacity),
    isWorkingDay: isWorkingDay !== undefined ? isWorkingDay : true,
    notes: notes || "",
  });

  return res.status(201).json({
    success: true,
    message: "Capacity set successfully",
    data: newCapacity,
    capacity: newCapacity,
  });
});

// Set capacity for multiple days (bulk)
export const setBulkCapacity = catchAsyncErrors(async (req, res, next) => {
  let { doctorId, startDate, endDate, capacity, maxPatients, isWorkingDay, notes } = req.body;

  doctorId = doctorId || req.user?._id;
  if (capacity === undefined && maxPatients !== undefined) {
    capacity = maxPatients;
  }

  if (!doctorId || !startDate || !endDate || capacity === undefined) {
    return next(new ErrorHandler("Please provide doctorId, startDate, endDate and capacity", 400));
  }

  const start = new Date(startDate);
  const end = new Date(endDate);
  
  if (start > end) {
    return next(new ErrorHandler("Start date cannot be after end date", 400));
  }

  const dateArray = [];
  let currentDate = new Date(start);
  while (currentDate <= end) {
    const year = currentDate.getFullYear();
    const month = String(currentDate.getMonth() + 1).padStart(2, "0");
    const day = String(currentDate.getDate()).padStart(2, "0");
    dateArray.push(`${year}-${month}-${day}`);
    currentDate.setDate(currentDate.getDate() + 1);
  }

  const bulkOperations = dateArray.map((dateStr) => {
    return {
      updateOne: {
        filter: { doctorId, serviceDate: dateStr },
        update: {
          $set: {
            capacity: Number(capacity),
            isWorkingDay: isWorkingDay !== undefined ? isWorkingDay : true,
            notes: notes || "",
          }
        },
        upsert: true,
      }
    };
  });

  await Capacity.bulkWrite(bulkOperations);

  return res.status(201).json({
    success: true,
    message: `Capacity set successfully for ${dateArray.length} days`,
  });
});

// Get capacities with range filtering
export const getCapacities = catchAsyncErrors(async (req, res, next) => {
  let { doctorId, startDate, endDate } = req.query;

  doctorId = doctorId || (req.user?.role === "Doctor" ? req.user._id : undefined);

  let filter = {};
  if (doctorId) {
    filter.doctorId = doctorId;
  }

  if (startDate && endDate) {
    filter.serviceDate = {
      $gte: startDate,
      $lte: endDate,
    };
  } else if (startDate) {
    filter.serviceDate = { $gte: startDate };
  } else if (endDate) {
    filter.serviceDate = { $lte: endDate };
  }

  const capacities = await Capacity.find(filter).sort({ serviceDate: 1 });

  return res.status(200).json({
    success: true,
    capacities,
    data: capacities,
  });
});

// Get capacities for specific doctor or /me
export const getDoctorCapacity = catchAsyncErrors(async (req, res, next) => {
  let docId = req.params.doctorId;
  if (docId === "me") {
    docId = req.user?._id;
  }
  if (!docId) {
    return next(new ErrorHandler("Doctor ID is required", 400));
  }

  const capacities = await Capacity.find({ doctorId: docId }).sort({ serviceDate: 1 });
  return res.status(200).json({
    success: true,
    capacities,
    data: capacities,
  });
});

// Delete a capacity entry by ID
export const deleteCapacity = catchAsyncErrors(async (req, res, next) => {
  const { id } = req.params;
  if (!id || !mongoose.isValidObjectId(id)) {
    return next(new ErrorHandler("Invalid capacity ID", 400));
  }

  const capacity = await Capacity.findById(id);
  if (!capacity) {
    return next(new ErrorHandler("Capacity record not found", 404));
  }

  await capacity.deleteOne();
  return res.status(200).json({
    success: true,
    message: "Capacity removed successfully",
  });
});
