import mongoose from "mongoose";
import { catchAsyncErrors } from "../middlewares/catchAsyncErrors.js";
import ErrorHandler from "../middlewares/error.js";
import { Template } from "../models/templateSchema.js";

// Create or update a template
export const createOrUpdateTemplate = catchAsyncErrors(async (req, res, next) => {
  const { id } = req.params;
  let doctorId = req.user._id;

  if (req.user.role === 'Admin' && req.body.doctorId && mongoose.Types.ObjectId.isValid(req.body.doctorId)) {
    doctorId = req.body.doctorId;
  }

  const templateData = { ...req.body, doctorId };

  // PUT /:id → update existing
  if (id) {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return next(new ErrorHandler("Invalid template ID", 400));
    }
    let template = await Template.findById(id);
    if (!template) {
      return next(new ErrorHandler("Template not found", 404));
    }
    if (template.doctorId.toString() !== doctorId.toString() && req.user.role !== 'Admin') {
      return next(new ErrorHandler("Not authorized to update this template", 403));
    }
    
    // If setting as default, unset others for this doctor
    if (templateData.isDefault) {
      await Template.updateMany({ doctorId, _id: { $ne: id } }, { isDefault: false });
    }

    template = await Template.findByIdAndUpdate(id, templateData, {
      new: true,
      runValidators: true,
      useFindAndModify: false,
    });
    return res.status(200).json({ success: true, message: "Template updated successfully", template });
  }

  // Otherwise create a new template
  if (templateData.isDefault) {
    await Template.updateMany({ doctorId }, { isDefault: false });
  }
  
  const template = await Template.create(templateData);
  res.status(201).json({ success: true, message: "Template created successfully", template });
});

// Get all templates for a doctor
export const getMyTemplates = catchAsyncErrors(async (req, res, next) => {
  let doctorId = req.user._id;
  
  if (
    req.query.doctorId &&
    req.query.doctorId !== "undefined" &&
    req.query.doctorId !== "null" &&
    mongoose.Types.ObjectId.isValid(req.query.doctorId)
  ) {
    doctorId = req.query.doctorId;
  }

  const templates = await Template.find({ doctorId }).sort({ isDefault: -1, createdAt: -1 });
  res.status(200).json({ success: true, templates });
});

// Delete a template
export const deleteTemplate = catchAsyncErrors(async (req, res, next) => {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return next(new ErrorHandler("Invalid template ID", 400));
  }
  const template = await Template.findById(id);
  
  if (!template) {
    return next(new ErrorHandler("Template not found", 404));
  }

  if (template.doctorId.toString() !== req.user._id.toString() && req.user.role !== 'Admin') {
    return next(new ErrorHandler("Not authorized to delete this template", 403));
  }

  await template.deleteOne();
  res.status(200).json({ success: true, message: "Template deleted successfully" });
});
