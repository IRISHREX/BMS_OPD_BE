import ClinicalFindings from "../models/clinicalFindingsSchema.js";
import ClinicalFindingsTemplate from "../models/clinicalFindingsTemplate.js";
import { catchAsyncErrors } from "../middlewares/catchAsyncErrors.js";
import ErrorHandler from "../middlewares/error.js";

// Get all templates for a doctor
export const getTemplates = catchAsyncErrors(async (req, res, next) => {
  const { doctorId } = req.params;
  const templates = await ClinicalFindingsTemplate.find({ doctorId });
  res.status(200).json({ success: true, templates });
});

// Get a single template by ID
export const getTemplate = catchAsyncErrors(async (req, res, next) => {
  const { templateId } = req.params;
  const template = await ClinicalFindingsTemplate.findById(templateId);
  if (!template) {
    return next(new ErrorHandler("Template not found", 404));
  }
  res.status(200).json({ success: true, template });
});

// Create a new template
export const createTemplate = catchAsyncErrors(async (req, res, next) => {
  const { doctorId, templateName, description, templateData, category, isDefault } = req.body;

  if (!doctorId || !templateName || !templateData) {
    return next(new ErrorHandler("Missing required fields", 400));
  }

  const template = await ClinicalFindingsTemplate.create({
    doctorId,
    templateName,
    description,
    templateData,
    category,
    isDefault,
  });

  res.status(201).json({ success: true, template });
});

// Update template
export const updateTemplate = catchAsyncErrors(async (req, res, next) => {
  const { templateId } = req.params;
  const { templateName, description, templateData, category, isDefault } = req.body;

  let template = await ClinicalFindingsTemplate.findById(templateId);
  if (!template) {
    return next(new ErrorHandler("Template not found", 404));
  }

  if (templateName) template.templateName = templateName;
  if (description !== undefined) template.description = description;
  if (templateData) template.templateData = templateData;
  if (category) template.category = category;
  if (isDefault !== undefined) template.isDefault = isDefault;
  template.updatedAt = Date.now();

  await template.save();
  res.status(200).json({ success: true, template });
});

// Delete template
export const deleteTemplate = catchAsyncErrors(async (req, res, next) => {
  const { templateId } = req.params;
  const template = await ClinicalFindingsTemplate.findByIdAndDelete(templateId);
  if (!template) {
    return next(new ErrorHandler("Template not found", 404));
  }
  res.status(200).json({ success: true, message: "Template deleted successfully" });
});

// Get templates by category
export const getTemplatesByCategory = catchAsyncErrors(async (req, res, next) => {
  const { doctorId, category } = req.params;
  const templates = await ClinicalFindingsTemplate.find({ doctorId, category });
  res.status(200).json({ success: true, templates });
});

// Save clinical findings
export const saveClinicalFindings = catchAsyncErrors(async (req, res, next) => {
  const { appointmentId, patientId, doctorId, onExamination, notes } = req.body;

  if (!appointmentId || !patientId || !doctorId || !onExamination) {
    return next(new ErrorHandler("Missing required fields", 400));
  }

  let clinicalFindings = await ClinicalFindings.findOne({ appointmentId });

  if (clinicalFindings) {
    clinicalFindings.onExamination = onExamination;
    clinicalFindings.notes = notes;
    clinicalFindings.updatedAt = Date.now();
    await clinicalFindings.save();
  } else {
    clinicalFindings = await ClinicalFindings.create({
      appointmentId,
      patientId,
      doctorId,
      onExamination,
      notes,
    });
  }

  res.status(200).json({ success: true, clinicalFindings });
});

// Get clinical findings for an appointment
export const getClinicalFindings = catchAsyncErrors(async (req, res, next) => {
  const { appointmentId } = req.params;
  const clinicalFindings = await ClinicalFindings.findOne({ appointmentId });
  if (!clinicalFindings) {
    return res.status(200).json({ success: true, clinicalFindings: null });
  }
  res.status(200).json({ success: true, clinicalFindings });
});

// Get default templates by category
export const getDefaultTemplatesByCategory = catchAsyncErrors(async (req, res, next) => {
  const { category } = req.params;
  const templates = await ClinicalFindingsTemplate.find({
    category,
    isDefault: true,
  });
  res.status(200).json({ success: true, templates });
});
