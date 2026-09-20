import mongoose from "mongoose";
import dotenv from "dotenv";
import dns from "dns";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { User } from "./models/userSchema.js";
import { Medicine } from "./models/medicineSchema.js";
import { DiagnosticTest } from "./models/testSchema.js";
import { MedicalAdvice } from "./models/medicalAdviceSchema.js";
import { orthoMedicines, orthoAdvices } from "./orthoData.js";
import { translateSqlToJson } from "./scripts/translateMedicineSql.js";
import { translateTestsSqlToJson } from "./scripts/translateTestsSql.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: "./.env" });

dns.setServers(["8.8.8.8", "1.1.1.1"]);

const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI) {
  console.error("❌ Error: MONGO_URI is not defined in .env file.");
  process.exit(1);
}

// Seed Data Definition

const adminUsers = [
  {
    firstName: "System",
    lastName: "Admin",
    name: "System Admin",
    email: "admin@pathology.com",
    phone: "9876543210",
    nic: "1234567890123",
    dob: new Date("1990-01-01"),
    gender: "Male",
    password: "AdminPass123!",
    role: "Admin",
  },
];

const doctorUsers = [
  {
    firstName: "John",
    lastName: "Doe",
    name: "Dr. John Doe",
    email: "doctor@pathology.com",
    phone: "9876543211",
    nic: "1234567890124",
    dob: new Date("1985-05-15"),
    gender: "Male",
    password: "DoctorPass123!",
    role: "Doctor",
    doctorDepartment: "Pathology & Diagnostics",
    qualifications: "MBBS, MD (Pathology)",
    consultationFee: 500,
  },
  {
    firstName: "Sarah",
    lastName: "Smith",
    name: "Dr. Sarah Smith",
    email: "dr.smith@pathology.com",
    phone: "9876543212",
    nic: "1234567890125",
    dob: new Date("1988-08-20"),
    gender: "Female",
    password: "DoctorPass123!",
    role: "Doctor",
    doctorDepartment: "General Medicine",
    qualifications: "MBBS, MD (General Medicine)",
    consultationFee: 600,
  },
];

const medicines = [
  {
    name: "Paracetamol",
    composition: ["Paracetamol 500mg"],
    type: "Tablet",
    dose: "500mg",
    frequency: "1-0-1",
    route: "Oral",
    duration: "5 days",
    notes: "Take after meals. Do not exceed 4g daily.",
  },
  {
    name: "Amoxicillin",
    composition: ["Amoxicillin 500mg"],
    type: "Capsule",
    dose: "500mg",
    frequency: "1-1-1",
    route: "Oral",
    duration: "7 days",
    notes: "Complete full course of antibiotics.",
  },
  {
    name: "Metformin",
    composition: ["Metformin Hydrochloride 500mg"],
    type: "Tablet",
    dose: "500mg",
    frequency: "1-0-1",
    route: "Oral",
    duration: "30 days",
    notes: "Take with or immediately after meals.",
  },
  {
    name: "Omeprazole",
    composition: ["Omeprazole 20mg"],
    type: "Capsule",
    dose: "20mg",
    frequency: "1-0-0",
    route: "Oral",
    duration: "14 days",
    notes: "Take 30 minutes before breakfast.",
  },
  {
    name: "Azithromycin",
    composition: ["Azithromycin 500mg"],
    type: "Tablet",
    dose: "500mg",
    frequency: "1-0-0",
    route: "Oral",
    duration: "3 days",
    notes: "Take 1 hour before or 2 hours after food.",
  },
  {
    name: "Pantoprazole",
    composition: ["Pantoprazole 40mg"],
    type: "Tablet",
    dose: "40mg",
    frequency: "1-0-0",
    route: "Oral",
    duration: "14 days",
    notes: "Take empty stomach in the morning.",
  },
  {
    name: "Cetirizine",
    composition: ["Cetirizine Hydrochloride 10mg"],
    type: "Tablet",
    dose: "10mg",
    frequency: "0-0-1",
    route: "Oral",
    duration: "5 days",
    notes: "May cause drowsiness. Take at night.",
  },
  {
    name: "Atorvastatin",
    composition: ["Atorvastatin Calcium 10mg"],
    type: "Tablet",
    dose: "10mg",
    frequency: "0-0-1",
    route: "Oral",
    duration: "30 days",
    notes: "Take at bedtime.",
  },
  {
    name: "Ciprofloxacin",
    composition: ["Ciprofloxacin 500mg"],
    type: "Tablet",
    dose: "500mg",
    frequency: "1-0-1",
    route: "Oral",
    duration: "5 days",
    notes: "Avoid taking with dairy products or antacids.",
  },
  {
    name: "Ibuprofen",
    composition: ["Ibuprofen 400mg"],
    type: "Tablet",
    dose: "400mg",
    frequency: "1-0-1",
    route: "Oral",
    duration: "3 days",
    notes: "Take with food or milk to prevent gastric irritation.",
  },
  {
    name: "Telmisartan",
    composition: ["Telmisartan 40mg"],
    type: "Tablet",
    dose: "40mg",
    frequency: "1-0-0",
    route: "Oral",
    duration: "30 days",
    notes: "Monitor blood pressure regularly.",
  },
  {
    name: "Amlodipine",
    composition: ["Amlodipine Besylate 5mg"],
    type: "Tablet",
    dose: "5mg",
    frequency: "1-0-0",
    route: "Oral",
    duration: "30 days",
    notes: "Take at the same time every day.",
  },
];

const medicalAdvices = [
  {
    name: "Fever & Upper Respiratory Infection",
    symptoms: ["Fever", "Cough", "Sore Throat", "Runny Nose", "Body Ache"],
    desese_description: "Acute viral upper respiratory tract infection presenting with fever and mild cold symptoms.",
    medicines: [
      {
        name: "Paracetamol",
        type: "Tablet",
        dose: "500mg",
        frequency: "1-0-1",
        route: "Oral",
        duration: "5 days",
        notes: "Take after meals when fever > 99°F",
      },
      {
        name: "Cetirizine",
        type: "Tablet",
        dose: "10mg",
        frequency: "0-0-1",
        route: "Oral",
        duration: "5 days",
        notes: "Take before sleep",
      },
    ],
    testAdvice: [
      {
        testName: "Complete Blood Count (CBC)",
        testType: "Blood Test",
        precautions: "No special preparation needed",
        testDate: "Immediate",
      },
      {
        testName: "C-Reactive Protein (CRP)",
        testType: "Blood Test",
        precautions: "Fasting not required",
        testDate: "Immediate",
      },
    ],
    medication: "Paracetamol 500mg tab BD, Cetirizine 10mg tab HS for 5 days.",
    diet: "Warm fluids, light digestible diet, plenty of oral hydration.",
    aliases: ["Cold and Fever", "Viral Fever", "URI"],
    tags: ["Fever", "Respiratory", "Routine"],
    followup: {
      days: 3,
      note: "Review if fever persists beyond 3 days or symptoms worsen.",
    },
  },
  {
    name: "Diabetes Mellitus Screening & Management",
    symptoms: ["Polyuria", "Polydipsia", "Fatigue", "Unexplained Weight Loss"],
    desese_description: "Metabolic disorder characterized by elevated blood glucose levels.",
    medicines: [
      {
        name: "Metformin",
        type: "Tablet",
        dose: "500mg",
        frequency: "1-0-1",
        route: "Oral",
        duration: "30 days",
        notes: "Take immediately after breakfast and dinner",
      },
    ],
    testAdvice: [
      {
        testName: "Fasting Blood Sugar (FBS)",
        testType: "Blood Test",
        precautions: "Requires 8-10 hours overnight fasting",
        testDate: "Tomorrow Morning",
      },
      {
        testName: "Post Prandial Blood Sugar (PPBS)",
        testType: "Blood Test",
        precautions: "2 hours after breakfast",
        testDate: "Tomorrow Morning",
      },
      {
        testName: "HbA1c (Glycated Hemoglobin)",
        testType: "Blood Test",
        precautions: "Fasting not mandatory",
        testDate: "Immediate",
      },
    ],
    medication: "Metformin 500mg tab BD after meals.",
    diet: "Low carbohydrate, high fiber diet. Avoid refined sugars and sweet drinks.",
    aliases: ["High Blood Sugar", "Diabetes"],
    tags: ["Endocrine", "Chronic", "Diabetes"],
    followup: {
      days: 14,
      note: "Check blood sugar log and review in 2 weeks.",
    },
  },
  {
    name: "Dyspepsia & Hyperacidity",
    symptoms: ["Epigastric Pain", "Heartburn", "Bloating", "Nausea"],
    desese_description: "Gastric irritation and acid reflux leading to discomfort in upper abdomen.",
    medicines: [
      {
        name: "Omeprazole",
        type: "Capsule",
        dose: "20mg",
        frequency: "1-0-0",
        route: "Oral",
        duration: "14 days",
        notes: "Take on empty stomach 30 mins before food",
      },
    ],
    testAdvice: [
      {
        testName: "Abdominal Ultrasound (USG)",
        testType: "Imaging",
        precautions: "Fasting for 6 hours prior to test",
        testDate: "As Advised",
      },
    ],
    medication: "Omeprazole 20mg cap OD before breakfast.",
    diet: "Avoid spicy, oily foods, tea/coffee, and late night heavy meals.",
    aliases: ["Gastritis", "Acid Reflux", "GERD"],
    tags: ["Gastroenterology", "Acidity"],
    followup: {
      days: 7,
      note: "Review after 1 week if no improvement.",
    },
  },
  {
    name: "Routine Pathology Workup",
    symptoms: ["General Health Checkup", "Fatigue", "Routine Screening"],
    desese_description: "Comprehensive health checkup laboratory testing profile.",
    medicines: [],
    testAdvice: [
      {
        testName: "Complete Blood Count (CBC)",
        testType: "Blood Test",
        precautions: "No special preparation needed",
        testDate: "Immediate",
      },
      {
        testName: "Lipid Profile",
        testType: "Blood Test",
        precautions: "Requires 10-12 hours overnight fasting",
        testDate: "Tomorrow Morning",
      },
      {
        testName: "Liver Function Test (LFT)",
        testType: "Blood Test",
        precautions: "Overnight fasting recommended",
        testDate: "Tomorrow Morning",
      },
      {
        testName: "Kidney Function Test (KFT)",
        testType: "Blood Test",
        precautions: "Stay hydrated",
        testDate: "Tomorrow Morning",
      },
      {
        testName: "Thyroid Profile (T3, T4, TSH)",
        testType: "Blood Test",
        precautions: "Fasting morning sample preferred",
        testDate: "Tomorrow Morning",
      },
      {
        testName: "Urine Routine & Microscopy",
        testType: "Urine Test",
        precautions: "First morning clean catch urine sample",
        testDate: "Tomorrow Morning",
      },
    ],
    medication: "None at present.",
    diet: "Balanced nutritious diet.",
    aliases: ["Executive Health Checkup", "Annual Health Screening"],
    tags: ["Routine", "Pathology", "Preventive"],
    followup: {
      days: 5,
      note: "Review after collecting lab test reports.",
    },
  },
];

// Seed Database Function

medicines.push(...orthoMedicines);

// Load and append SQL translated medicines from medicines.json
const medicinesJsonPath = path.join(__dirname, "medicines.json");
if (!fs.existsSync(medicinesJsonPath)) {
  console.log("⚙️ medicines.json not found. Translating from medicine.sql...");
  await translateSqlToJson();
}

if (fs.existsSync(medicinesJsonPath)) {
  try {
    const sqlMedicines = JSON.parse(fs.readFileSync(medicinesJsonPath, "utf-8"));
    medicines.push(...sqlMedicines);
    console.log(`📦 Loaded ${sqlMedicines.length} medicines from medicines.json`);
  } catch (err) {
    console.warn("⚠️ Warning: Failed to parse medicines.json:", err.message);
  }
}

// Load and append SQL translated diagnostic tests from diagnosticTests.json
const diagnosticTestsJsonPath = path.join(__dirname, "diagnosticTests.json");
if (!fs.existsSync(diagnosticTestsJsonPath)) {
  console.log("⚙️ diagnosticTests.json not found. Translating from pathology.sql & radio.sql...");
  await translateTestsSqlToJson();
}

let diagnosticTests = [];
if (fs.existsSync(diagnosticTestsJsonPath)) {
  try {
    diagnosticTests = JSON.parse(fs.readFileSync(diagnosticTestsJsonPath, "utf-8"));
    console.log(`📦 Loaded ${diagnosticTests.length} diagnostic tests from diagnosticTests.json`);
  } catch (err) {
    console.warn("⚠️ Warning: Failed to parse diagnosticTests.json:", err.message);
  }
}

medicalAdvices.push(...orthoAdvices);

async function seedDatabase() {
  const isCleanRun = process.argv.includes("--clean");

  try {
    console.log("⏳ Connecting to MongoDB...");
    await mongoose.connect(MONGO_URI, {
      dbName: "MERN_STACK_HOSPITAL_MANAGEMENT",
    });
    console.log("✅ Successfully connected to MongoDB.");

    if (isCleanRun) {
      console.log("🧹 Flag --clean detected: Purging existing seeded collections...");
      await User.deleteMany({ email: { $in: [...adminUsers, ...doctorUsers].map((u) => u.email) } });
      await Medicine.deleteMany({});
      await DiagnosticTest.deleteMany({});
      await MedicalAdvice.deleteMany({});
      console.log("✅ Cleanup complete.");
    }

    // 1. Seed Admin Users
    console.log("\n👤 Seeding Admin users...");
    let adminsSeeded = 0;
    for (const adminData of adminUsers) {
      const existing = await User.findOne({ email: adminData.email });
      if (!existing) {
        await User.create(adminData);
        console.log(`   + Created Admin: ${adminData.email} (${adminData.name})`);
        adminsSeeded++;
      } else {
        console.log(`   . Admin already exists: ${adminData.email}`);
      }
    }
    console.log(`✅ Admin seeding done (${adminsSeeded} created).`);

    // 2. Seed Doctor Users
    console.log("\n👨‍⚕️ Seeding Doctor users...");
    let doctorsSeeded = 0;
    for (const docData of doctorUsers) {
      const existing = await User.findOne({ email: docData.email });
      if (!existing) {
        await User.create(docData);
        console.log(`   + Created Doctor: ${docData.email} (${docData.name})`);
        doctorsSeeded++;
      } else {
        console.log(`   . Doctor already exists: ${docData.email}`);
      }
    }
    console.log(`✅ Doctor seeding done (${doctorsSeeded} created).`);

    // 3. Seed Medicines
    console.log(`\n💊 Seeding Medicines (${medicines.length} candidates in dataset)...`);
    const existingMeds = await Medicine.find({}, { name: 1 }).lean();
    const existingNames = new Set(existingMeds.map((m) => m.name.toLowerCase().trim()));

    const toInsert = [];
    for (const medData of medicines) {
      const norm = medData.name.toLowerCase().trim();
      if (!existingNames.has(norm)) {
        toInsert.push(medData);
        existingNames.add(norm); // guard against duplicates within dataset
      }
    }

    let medicinesSeeded = 0;
    if (toInsert.length > 0) {
      console.log(`   + Inserting ${toInsert.length} new medicines in batches...`);
      const BATCH_SIZE = 500;
      for (let i = 0; i < toInsert.length; i += BATCH_SIZE) {
        const batch = toInsert.slice(i, i + BATCH_SIZE);
        await Medicine.insertMany(batch, { ordered: false });
        medicinesSeeded += batch.length;
        console.log(`   + Inserted batch: ${medicinesSeeded}/${toInsert.length} medicines...`);
      }
    } else {
      console.log("   . All medicines are already present in the database.");
    }
    console.log(`✅ Medicine seeding done (${medicinesSeeded} new inserted, ${existingMeds.length + medicinesSeeded} total in DB).`);

    // 4. Seed Diagnostic Tests (Pathology & Radiology)
    console.log(`\n🧪 Seeding Diagnostic Tests (${diagnosticTests.length} candidates in dataset)...`);
    const existingTests = await DiagnosticTest.find({}, { name: 1 }).lean();
    const existingTestNames = new Set(existingTests.map((t) => t.name.toLowerCase().trim()));

    const testsToInsert = [];
    for (const testData of diagnosticTests) {
      const norm = testData.name.toLowerCase().trim();
      if (!existingTestNames.has(norm)) {
        testsToInsert.push(testData);
        existingTestNames.add(norm); // guard against duplicates
      }
    }

    let testsSeeded = 0;
    if (testsToInsert.length > 0) {
      console.log(`   + Inserting ${testsToInsert.length} new diagnostic tests in batches...`);
      const BATCH_SIZE = 250;
      for (let i = 0; i < testsToInsert.length; i += BATCH_SIZE) {
        const batch = testsToInsert.slice(i, i + BATCH_SIZE);
        await DiagnosticTest.insertMany(batch, { ordered: false });
        testsSeeded += batch.length;
        console.log(`   + Inserted batch: ${testsSeeded}/${testsToInsert.length} diagnostic tests...`);
      }
    } else {
      console.log("   . All diagnostic tests are already present in the database.");
    }
    console.log(`✅ Diagnostic Test seeding done (${testsSeeded} new inserted, ${existingTests.length + testsSeeded} total in DB).`);

    // 5. Seed Medical Advice / Pathology Tests
    console.log("\n🔬 Seeding Medical Advice & Pathology Tests...");
    let advicesSeeded = 0;
    for (const adviceData of medicalAdvices) {
      const existing = await MedicalAdvice.findOne({ name: adviceData.name });
      if (!existing) {
        await MedicalAdvice.create(adviceData);
        console.log(`   + Added Advice/Test Profile: "${adviceData.name}"`);
        advicesSeeded++;
      } else {
        console.log(`   . Advice/Test Profile already exists: "${adviceData.name}"`);
      }
    }
    console.log(`✅ Medical Advice & Tests seeding done (${advicesSeeded} created).`);

    console.log("\n🎉 All database seeding operations finished successfully!");
  } catch (error) {
    console.error("\n❌ Error during database seeding:", error);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
    console.log("🔌 Disconnected from MongoDB.");
  }
}

seedDatabase();
