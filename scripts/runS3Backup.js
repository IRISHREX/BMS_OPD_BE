import { uploadToS3, uploadCsvBackupToS3 } from "../utils/s3Storage.js";
import mongoose from "mongoose";
import fs from "fs";
import { Appointment } from "../models/appointmentSchema.js";
import { User } from "../models/userSchema.js";
import { Medicine } from "../models/medicineSchema.js";

const toCsv = (records) => {
  if (!records || records.length === 0) return "";
  const headers = Object.keys(records[0]);
  const rows = records.map((row) =>
    headers
      .map((header) => {
        let val = row[header] === null || row[header] === undefined ? "" : String(row[header]);
        if (val.includes(",") || val.includes('"') || val.includes("\n") || val.includes("\r")) {
          val = `"${val.replace(/"/g, '""')}"`;
        }
        return val;
      })
      .join(",")
  );
  return [headers.join(","), ...rows].join("\r\n");
};

async function runBackup() {
  const timestamp = process.argv[3] || new Date().toISOString().replace(/[:.]/g, "-");
  const archivePath = process.argv[2];

  console.log(`Starting automated backup for timestamp: ${timestamp}`);
  await mongoose.connect(process.env.MONGO_URI || "mongodb://127.0.0.1:27017/MERN_STACK_HOSPITAL_MANAGEMENT");

  // 1. Upload mongodump archive to S3 if provided
  if (archivePath && fs.existsSync(archivePath)) {
    const archiveBuffer = fs.readFileSync(archivePath);
    await uploadToS3(`backups/mongodb/${timestamp}_mongo_dump.gz`, archiveBuffer, "application/gzip");
    console.log(`✅ Uploaded mongodump archive to S3`);
  }

  // 2. Export and upload Appointments CSV
  const appointments = await Appointment.find().sort({ createdAt: -1 });
  const apptRows = appointments.map((a, i) => ({
    SL: i + 1,
    AppointmentID: a.appointmentId || a._id.toString(),
    PatientName: a.name || "-",
    Phone: a.phone || "-",
    Date: a.appointment_date ? a.appointment_date.slice(0, 10) : "-",
    Department: a.department || "-",
    Status: a.status || "-",
  }));
  await uploadCsvBackupToS3(`${timestamp}_appointments.csv`, toCsv(apptRows));
  console.log(`✅ Uploaded ${apptRows.length} appointments to S3 CSV`);

  // 3. Export and upload Patients CSV
  const patients = await User.find({ role: "Patient" });
  const ptRows = patients.map((p, i) => ({
    SL: i + 1,
    PatientID: p._id.toString(),
    Name: p.name || `${p.firstName || ""} ${p.lastName || ""}`.trim() || "-",
    Phone: p.phone || "-",
    Email: p.email || "-",
    Age: p.age || "-",
    Gender: p.gender || "-",
  }));
  await uploadCsvBackupToS3(`${timestamp}_patients.csv`, toCsv(ptRows));
  console.log(`✅ Uploaded ${ptRows.length} patients to S3 CSV`);

  // 4. Export and upload Medicines CSV
  const medicines = await Medicine.find().lean();
  const medRows = medicines.map((m, i) => ({
    SL: i + 1,
    Name: m.name || "-",
    Type: m.type || "-",
    Composition: Array.isArray(m.composition) ? m.composition.join("; ") : m.composition || "-",
  }));
  await uploadCsvBackupToS3(`${timestamp}_medicines.csv`, toCsv(medRows));
  console.log(`✅ Uploaded ${medRows.length} medicines to S3 CSV`);

  await mongoose.disconnect();
  console.log(`🎉 Automated backup completed successfully!`);
}

runBackup().catch((e) => {
  console.error("❌ Backup script error:", e);
  process.exit(1);
});
