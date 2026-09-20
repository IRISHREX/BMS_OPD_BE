import { catchAsyncErrors } from "../middlewares/catchAsyncErrors.js";
import ErrorHandler from "../middlewares/error.js";
import { DiagnosticTest } from "../models/testSchema.js";

export const DEFAULT_TESTS = [
  { name: "Complete Blood Count (CBC)", category: "Blood Test" },
  { name: "Blood Sugar (FBS / Fasting)", category: "Blood Test" },
  { name: "Blood Sugar (PPBS / Post Prandial)", category: "Blood Test" },
  { name: "HbA1c (Glycated Hemoglobin)", category: "Blood Test" },
  { name: "Lipid Profile", category: "Blood Test" },
  { name: "Liver Function Test (LFT)", category: "Blood Test" },
  { name: "Kidney Function Test (KFT / RFT)", category: "Blood Test" },
  { name: "Serum Uric Acid", category: "Blood Test" },
  { name: "Thyroid Profile (T3, T4, TSH)", category: "Blood Test" },
  { name: "CRP (C-Reactive Protein)", category: "Blood Test" },
  { name: "ESR (Erythrocyte Sedimentation Rate)", category: "Blood Test" },
  { name: "Vitamin D3 (25-OH)", category: "Blood Test" },
  { name: "Vitamin B12", category: "Blood Test" },
  { name: "Serum Electrolytes", category: "Blood Test" },
  { name: "Urine Routine & Microscopic", category: "Urine Test" },
  { name: "24-Hour Urine Protein", category: "Urine Test" },
  { name: "Urine Culture & Sensitivity", category: "Urine Test" },
  { name: "X-Ray Chest PA View", category: "Imaging" },
  { name: "X-Ray Knee AP / LAT View", category: "Imaging" },
  { name: "X-Ray Lumbosacral Spine AP / LAT", category: "Imaging" },
  { name: "X-Ray Shoulder AP View", category: "Imaging" },
  { name: "X-Ray Cervical Spine AP / LAT", category: "Imaging" },
  { name: "MRI Lumbar Spine", category: "Imaging" },
  { name: "MRI Brain", category: "Imaging" },
  { name: "CT Scan Head", category: "Imaging" },
  { name: "Abdominal Ultrasound (USG)", category: "Imaging" },
  { name: "USG Pelvis / KUB", category: "Imaging" },
  { name: "ECG (Electrocardiogram)", category: "Cardiology" },
  { name: "2D Echocardiography (ECHO)", category: "Cardiology" },
  { name: "Treadmill Test (TMT)", category: "Cardiology" },
  { name: "Pap Smear", category: "Pathology" },
  { name: "Biopsy Histopathology", category: "Pathology" },
  { name: "Fine Needle Aspiration Cytology (FNAC)", category: "Pathology" },
  { name: "Stool Routine & Occult Blood", category: "Pathology" },
  { name: "Sputum AFB", category: "Microbiology" },
  { name: "Blood Culture & Sensitivity", category: "Microbiology" },
  { name: "Widal Test (Typhoid)", category: "Serology" },
  { name: "Dengue NS1 Antigen & IgM/IgG", category: "Serology" },
  { name: "HIV 1 & 2 Antibody Test", category: "Serology" },
  { name: "HBsAg (Hepatitis B Surface Antigen)", category: "Serology" },
  { name: "HCV Antibody", category: "Serology" },
  { name: "Serum Ferritin", category: "Biochemistry" },
  { name: "Serum Iron Profile", category: "Biochemistry" },
];

// ==================== INDIVIDUAL DIAGNOSTIC TESTS ====================

export const getAllTests = catchAsyncErrors(async (req, res, next) => {
  let count = await DiagnosticTest.countDocuments();
  if (count === 0) {
    await DiagnosticTest.insertMany(DEFAULT_TESTS);
  }

  const { search, category, type } = req.query;
  const filter = {};

  if (search) {
    filter.$or = [
      { name: { $regex: search, $options: "i" } },
      { category: { $regex: search, $options: "i" } },
    ];
  }

  const selectedCategory = category || type;
  if (selectedCategory && selectedCategory !== "All") {
    filter.$or = [
      { category: selectedCategory },
      { type: selectedCategory }, // backward-compatibility with older records
    ];
  }

  const tests = await DiagnosticTest.find(filter).sort({ name: 1 });
  res.status(200).json({
    success: true,
    total: tests.length,
    tests,
  });
});

export const createTest = catchAsyncErrors(async (req, res, next) => {
  const { names, tests, name, category, type } = req.body;
  const defaultCat = category || type || "General";

  // Multi-test creation via array of test objects: [{ name, category }]
  if (Array.isArray(tests) && tests.length > 0) {
    const validTests = tests.filter((t) => t && (typeof t === "string" ? t.trim() : (t.name && t.name.trim())));
    if (validTests.length === 0) {
      return next(new ErrorHandler("Please provide at least one valid test name!", 400));
    }
    const docs = validTests.map((t) => {
      if (typeof t === "string") {
        return { name: t.trim(), category: defaultCat };
      }
      return {
        name: t.name.trim(),
        category: (t.category || defaultCat).trim() || "General",
      };
    });
    const createdTests = await DiagnosticTest.insertMany(docs);
    return res.status(201).json({
      success: true,
      message: `${createdTests.length} test(s) created successfully!`,
      tests: createdTests,
    });
  }

  // Multi-test creation via array of names: ["CBC", "ECG"]
  if (Array.isArray(names) && names.length > 0) {
    const validNames = names.map((n) => (typeof n === "string" ? n.trim() : "")).filter(Boolean);
    if (validNames.length === 0) {
      return next(new ErrorHandler("Please provide at least one valid test name!", 400));
    }
    const docs = validNames.map((testName) => ({
      name: testName,
      category: defaultCat,
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
    category: defaultCat.trim() || "General",
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

  const updateData = {};
  if (req.body.name) updateData.name = req.body.name.trim();
  if (req.body.category !== undefined) updateData.category = req.body.category.trim() || "General";
  if (req.body.type !== undefined && req.body.category === undefined) updateData.category = req.body.type.trim() || "General";

  test = await DiagnosticTest.findByIdAndUpdate(req.params.id, updateData, {
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
