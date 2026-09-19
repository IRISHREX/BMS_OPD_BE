import { catchAsyncErrors } from "../middlewares/catchAsyncErrors.js";
import ErrorHandler from "../middlewares/error.js";
import { DiagnosticTest } from "../models/testSchema.js";
import { TestTemplate } from "../models/testTemplateSchema.js";

const DEFAULT_TESTS = [
  { name: "Complete Blood Count (CBC)", type: "Blood Test", precautions: "None", department: "Hematology", description: "Evaluates overall health and detects anemia, infection, etc." },
  { name: "Blood Sugar (FBS / Fasting)", type: "Blood Test", precautions: "Fasting 8-10 hours prior to test", department: "Biochemistry", description: "Measures blood glucose after fasting." },
  { name: "Blood Sugar (PPBS / Post Prandial)", type: "Blood Test", precautions: "2 hours after meal", department: "Biochemistry", description: "Measures blood glucose 2 hours after meal." },
  { name: "HbA1c (Glycated Hemoglobin)", type: "Blood Test", precautions: "None", department: "Biochemistry", description: "Average blood sugar over the past 2-3 months." },
  { name: "Lipid Profile", type: "Blood Test", precautions: "Fasting 10-12 hours", department: "Biochemistry", description: "Total cholesterol, HDL, LDL, Triglycerides." },
  { name: "Liver Function Test (LFT)", type: "Blood Test", precautions: "Fasting preferred", department: "Biochemistry", description: "Bilirubin, SGOT, SGPT, Alkaline Phosphatase." },
  { name: "Kidney Function Test (KFT / RFT)", type: "Blood Test", precautions: "None", department: "Biochemistry", description: "Serum Creatinine, Urea, Uric Acid, Electrolytes." },
  { name: "Serum Uric Acid", type: "Blood Test", precautions: "Fasting preferred", department: "Biochemistry", description: "Evaluates gout and kidney disorders." },
  { name: "Thyroid Profile (T3, T4, TSH)", type: "Blood Test", precautions: "Early morning sample preferred", department: "Endocrinology", description: "Evaluates thyroid gland function." },
  { name: "CRP (C-Reactive Protein)", type: "Blood Test", precautions: "None", department: "Serology", description: "Marker of general body inflammation or infection." },
  { name: "ESR (Erythrocyte Sedimentation Rate)", type: "Blood Test", precautions: "None", department: "Hematology", description: "Rate at which red blood cells sediment." },
  { name: "Urine Routine & Microscopic", type: "Urine Test", precautions: "Mid-stream clean catch morning urine", department: "Pathology", description: "Detects UTIs, kidney disease, diabetes." },
  { name: "X-Ray Chest PA View", type: "Imaging", precautions: "Remove metallic items/jewelry", department: "Radiology", description: "Evaluates lungs, heart, and chest wall." },
  { name: "X-Ray Knee AP / LAT View", type: "Imaging", precautions: "Remove metallic objects", department: "Radiology", description: "Evaluates knee joint spaces, arthritis, fractures." },
  { name: "X-Ray Lumbosacral Spine AP / LAT", type: "Imaging", precautions: "None", department: "Radiology", description: "Evaluates lower back, vertebrae, disc spaces." },
  { name: "X-Ray Shoulder AP View", type: "Imaging", precautions: "Remove metallic objects", department: "Radiology", description: "Evaluates shoulder joint and rotator cuff calcification." },
  { name: "MRI Lumbar Spine", type: "Imaging", precautions: "No pacemaker or metallic implants", department: "Radiology", description: "Detailed imaging of spinal nerves and discs." },
  { name: "Abdominal Ultrasound (USG)", type: "Imaging", precautions: "Fasting for 6 hours prior to test", department: "Radiology", description: "Images liver, gallbladder, kidneys, spleen." },
  { name: "ECG (Electrocardiogram)", type: "Cardiology", precautions: "Rest quietly before test", department: "Cardiology", description: "Records electrical activity of the heart." },
  { name: "Vitamin D3 (25-OH)", type: "Blood Test", precautions: "None", department: "Biochemistry", description: "Evaluates bone health and vitamin D deficiency." },
  { name: "Vitamin B12", type: "Blood Test", precautions: "Fasting preferred", department: "Biochemistry", description: "Evaluates neuropathy and macrocytic anemia." },
];

const DEFAULT_TEMPLATES = [
  {
    name: "Fever & Infection Panel",
    category: "Infectious Disease",
    description: "Standard acute febrile illness panel for fever investigation.",
    tags: ["Fever", "Infection", "Acute"],
    tests: [
      { testName: "Complete Blood Count (CBC)", testType: "Blood Test", precautions: "None", testDate: "Immediate" },
      { testName: "ESR (Erythrocyte Sedimentation Rate)", testType: "Blood Test", precautions: "None", testDate: "Immediate" },
      { testName: "CRP (C-Reactive Protein)", testType: "Blood Test", precautions: "None", testDate: "Immediate" },
      { testName: "Urine Routine & Microscopic", testType: "Urine Test", precautions: "Mid-stream catch", testDate: "Immediate" },
    ],
  },
  {
    name: "Diabetes Care & Monitoring Profile",
    category: "Endocrinology",
    description: "Comprehensive metabolic panel for diabetic patients.",
    tags: ["Diabetes", "Metabolic", "Routine"],
    tests: [
      { testName: "Blood Sugar (FBS / Fasting)", testType: "Blood Test", precautions: "Fasting 8-10 hours", testDate: "Tomorrow Morning" },
      { testName: "Blood Sugar (PPBS / Post Prandial)", testType: "Blood Test", precautions: "2 hours after meal", testDate: "Tomorrow Morning" },
      { testName: "HbA1c (Glycated Hemoglobin)", testType: "Blood Test", precautions: "None", testDate: "Immediate" },
      { testName: "Lipid Profile", testType: "Blood Test", precautions: "Fasting 10-12 hours", testDate: "Tomorrow Morning" },
      { testName: "Kidney Function Test (KFT / RFT)", testType: "Blood Test", precautions: "None", testDate: "Immediate" },
    ],
  },
  {
    name: "Joint Pain & Arthritis Panel",
    category: "Orthopedics",
    description: "Diagnostic profile for acute/chronic joint pains, gout, and arthritis.",
    tags: ["Orthopedic", "Joint Pain", "Arthritis"],
    tests: [
      { testName: "Serum Uric Acid", testType: "Blood Test", precautions: "Fasting preferred", testDate: "Tomorrow Morning" },
      { testName: "CRP (C-Reactive Protein)", testType: "Blood Test", precautions: "None", testDate: "Immediate" },
      { testName: "ESR (Erythrocyte Sedimentation Rate)", testType: "Blood Test", precautions: "None", testDate: "Immediate" },
      { testName: "Vitamin D3 (25-OH)", testType: "Blood Test", precautions: "None", testDate: "Immediate" },
    ],
  },
  {
    name: "Comprehensive Annual Health Checkup",
    category: "General Health",
    description: "Full body baseline diagnostic profile covering vital organ functions.",
    tags: ["Annual Checkup", "Executive", "General"],
    tests: [
      { testName: "Complete Blood Count (CBC)", testType: "Blood Test", precautions: "None", testDate: "Immediate" },
      { testName: "Liver Function Test (LFT)", testType: "Blood Test", precautions: "Fasting preferred", testDate: "Tomorrow Morning" },
      { testName: "Kidney Function Test (KFT / RFT)", testType: "Blood Test", precautions: "None", testDate: "Tomorrow Morning" },
      { testName: "Lipid Profile", testType: "Blood Test", precautions: "Fasting 10-12 hours", testDate: "Tomorrow Morning" },
      { testName: "Thyroid Profile (T3, T4, TSH)", testType: "Blood Test", precautions: "Morning sample", testDate: "Tomorrow Morning" },
      { testName: "ECG (Electrocardiogram)", testType: "Cardiology", precautions: "Rest quietly", testDate: "Immediate" },
      { testName: "Urine Routine & Microscopic", testType: "Urine Test", precautions: "Mid-stream catch", testDate: "Immediate" },
    ],
  },
];

// ==================== INDIVIDUAL DIAGNOSTIC TESTS ====================

export const getAllTests = catchAsyncErrors(async (req, res, next) => {
  let count = await DiagnosticTest.countDocuments();
  if (count === 0) {
    await DiagnosticTest.insertMany(DEFAULT_TESTS);
  }

  const { search, type } = req.query;
  const filter = {};

  if (search) {
    filter.$or = [
      { name: { $regex: search, $options: "i" } },
      { department: { $regex: search, $options: "i" } },
      { description: { $regex: search, $options: "i" } },
    ];
  }

  if (type && type !== "All") {
    filter.type = type;
  }

  const tests = await DiagnosticTest.find(filter).sort({ name: 1 });
  res.status(200).json({
    success: true,
    total: tests.length,
    tests,
  });
});

export const createTest = catchAsyncErrors(async (req, res, next) => {
  const { names, tests, name, type, precautions, department, description, normalRange, price } = req.body;

  // Multi-test creation via array of names
  if (Array.isArray(names) && names.length > 0) {
    const validNames = names.map((n) => (typeof n === "string" ? n.trim() : "")).filter(Boolean);
    if (validNames.length === 0) {
      return next(new ErrorHandler("Please provide at least one valid test name!", 400));
    }
    const docs = validNames.map((testName) => ({
      name: testName,
      type: type || "General",
      precautions: precautions || "",
      department: department || "",
      description: description || "",
      normalRange: normalRange || "",
      price: price || 0,
    }));
    const createdTests = await DiagnosticTest.insertMany(docs);
    return res.status(201).json({
      success: true,
      message: `${createdTests.length} test(s) created successfully!`,
      tests: createdTests,
    });
  }

  // Multi-test creation via array of test objects
  if (Array.isArray(tests) && tests.length > 0) {
    const validTests = tests.filter((t) => t && t.name && t.name.trim());
    if (validTests.length === 0) {
      return next(new ErrorHandler("Please provide at least one valid test name!", 400));
    }
    const docs = validTests.map((t) => ({
      name: t.name.trim(),
      type: t.type || "General",
      precautions: t.precautions || "",
      department: t.department || "",
      description: t.description || "",
      normalRange: t.normalRange || "",
      price: t.price || 0,
    }));
    const createdTests = await DiagnosticTest.insertMany(docs);
    return res.status(201).json({
      success: true,
      message: `${createdTests.length} test(s) created successfully!`,
      tests: createdTests,
    });
  }

  // Single test creation
  if (!name || !name.trim()) {
    return next(new ErrorHandler("Test name is required!", 400));
  }

  const test = await DiagnosticTest.create({
    name: name.trim(),
    type: type || "General",
    precautions: precautions || "",
    department: department || "",
    description: description || "",
    normalRange: normalRange || "",
    price: price || 0,
  });

  res.status(201).json({
    success: true,
    message: "Test created successfully!",
    test,
  });
});

export const updateTest = catchAsyncErrors(async (req, res, next) => {
  let test = await DiagnosticTest.findById(req.params.id);
  if (!test) {
    return next(new ErrorHandler("Diagnostic Test not found!", 404));
  }

  test = await DiagnosticTest.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });

  res.status(200).json({
    success: true,
    message: "Test updated successfully!",
    test,
  });
});

export const deleteTest = catchAsyncErrors(async (req, res, next) => {
  const test = await DiagnosticTest.findById(req.params.id);
  if (!test) {
    return next(new ErrorHandler("Diagnostic Test not found!", 404));
  }

  await test.deleteOne();
  res.status(200).json({
    success: true,
    message: "Test deleted successfully!",
  });
});

// ==================== TEST TEMPLATES / PANELS ====================

export const getAllTestTemplates = catchAsyncErrors(async (req, res, next) => {
  let count = await TestTemplate.countDocuments();
  if (count === 0) {
    await TestTemplate.insertMany(DEFAULT_TEMPLATES);
  }

  const { search, category } = req.query;
  const filter = {};

  if (search) {
    filter.$or = [
      { name: { $regex: search, $options: "i" } },
      { category: { $regex: search, $options: "i" } },
      { description: { $regex: search, $options: "i" } },
      { "tests.testName": { $regex: search, $options: "i" } },
    ];
  }

  if (category && category !== "All") {
    filter.category = category;
  }

  const templates = await TestTemplate.find(filter).sort({ name: 1 });
  res.status(200).json({
    success: true,
    total: templates.length,
    templates,
  });
});

export const createTestTemplate = catchAsyncErrors(async (req, res, next) => {
  const { name, category, description, tests, tags, isDefault } = req.body;
  if (!name || !name.trim()) {
    return next(new ErrorHandler("Template name is required!", 400));
  }

  // Normalize tests if passed as strings or objects
  const normalizedTests = (Array.isArray(tests) ? tests : [])
    .map((t) => {
      if (typeof t === "string" && t.trim()) {
        return { testName: t.trim(), testType: "", precautions: "", testDate: "" };
      }
      if (t && typeof t === "object") {
        const testName = (t.testName || t.name || "").trim();
        if (!testName) return null;
        return {
          testName,
          testType: t.testType || t.type || "",
          precautions: t.precautions || "",
          testDate: t.testDate || "",
        };
      }
      return null;
    })
    .filter(Boolean);

  const template = await TestTemplate.create({
    name: name.trim(),
    category: category ? category.trim() : "General Profile",
    description: description ? description.trim() : "",
    tests: normalizedTests,
    tags: Array.isArray(tags) ? tags : [],
    isDefault: !!isDefault,
  });

  res.status(201).json({
    success: true,
    message: "Test Template created successfully!",
    template,
  });
});

export const updateTestTemplate = catchAsyncErrors(async (req, res, next) => {
  let template = await TestTemplate.findById(req.params.id);
  if (!template) {
    return next(new ErrorHandler("Test Template not found!", 404));
  }

  const updateData = { ...req.body };
  if (updateData.name) {
    updateData.name = updateData.name.trim();
  }
  if (Array.isArray(updateData.tests)) {
    updateData.tests = updateData.tests
      .map((t) => {
        if (typeof t === "string" && t.trim()) {
          return { testName: t.trim(), testType: "", precautions: "", testDate: "" };
        }
        if (t && typeof t === "object") {
          const testName = (t.testName || t.name || "").trim();
          if (!testName) return null;
          return {
            testName,
            testType: t.testType || t.type || "",
            precautions: t.precautions || "",
            testDate: t.testDate || "",
          };
        }
        return null;
      })
      .filter(Boolean);
  }

  template = await TestTemplate.findByIdAndUpdate(req.params.id, updateData, {
    new: true,
    runValidators: true,
  });

  res.status(200).json({
    success: true,
    message: "Test Template updated successfully!",
    template,
  });
});

export const deleteTestTemplate = catchAsyncErrors(async (req, res, next) => {
  const template = await TestTemplate.findById(req.params.id);
  if (!template) {
    return next(new ErrorHandler("Test Template not found!", 404));
  }

  await template.deleteOne();
  res.status(200).json({
    success: true,
    message: "Test Template deleted successfully!",
  });
});
