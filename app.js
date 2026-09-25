import express from "express";
import { dbConnection } from "./database/dbConnection.js";
import { config } from "dotenv";
import cookieParser from "cookie-parser";
import cors from "cors";
import path from 'path';
import fs from 'fs';
import { getS3Object } from "./utils/s3Storage.js";
import { errorMiddleware } from "./middlewares/error.js";
import messageRouter from "./router/messageRouter.js";
import userRouter from "./router/userRouter.js";
import appointmentRouter from "./router/appointmentRouter.js";
import medicalAdviceRouter from "./router/medicalAdviceRouter.js";
import invoiceRouter from "./router/invoiceRouter.js";
import reportRouter from "./router/reportRouter.js";
import medicineRouter from "./router/medicineRouter.js";
import clinicalFindingsRouter from "./router/clinicalFindingsRouter.js";
import hospitalRouter from "./router/hospitalRouter.js";
import referralRouter from "./router/referralRouter.js";
import capacityRouter from "./router/capacityRouter.js";
import templateRouter from "./router/templateRouter.js";
import backupRouter from "./router/backupRouter.js";
import logRouter from "./router/logRouter.js";
import testRouter from "./router/testRouter.js";
import adviceRouter from "./router/adviceRouter.js";
import prescriptionRouter from "./router/prescriptionRouter.js";
import setupSwagger from "./utils/swagger.js";

const app = express();
config({ path: "./.env" });

// Build an explicit whitelist for CORS. Do NOT use '*' when credentials: true.
// Add common local dev origins so the dashboard and frontend can talk to the API
// without extra env configuration during development.
const frontendOrigins = [
  process.env.FRONTEND_URL_ONE,
  process.env.FRONTEND_URL_TWO,
  process.env.FRONTEND_URL_PROD,
  process.env.FRONTEND_URL_PROD_TWO,
].filter(Boolean);
// Custom CORS middleware: reflect the `Origin` header so any origin can access.
// If an `Origin` header is present we echo it back and allow credentials.
// If no Origin is present, we fallback to '*'.
app.use((req, res, next) => {
  const requestOrigin = req.headers.origin;
  if (requestOrigin) {
    res.setHeader('Access-Control-Allow-Origin', requestOrigin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  } else {
    res.setHeader('Access-Control-Allow-Origin', '*');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept, Origin, X-Requested-With');

  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Smart endpoint for /uploads/doctors/:filename:
// 1. Checks local disk
// 2. If missing locally, fetches from S3 bucket (aic-585105c0) and caches locally
app.get('/uploads/doctors/:filename', async (req, res) => {
  const { filename } = req.params;
  const localDir = path.join(process.cwd(), 'uploads', 'doctors');
  const localPath = path.join(localDir, filename);

  if (fs.existsSync(localPath)) {
    return res.sendFile(localPath);
  }

  try {
    const s3Data = await getS3Object(`doctors/${filename}`);
    if (s3Data && s3Data.Body) {
      res.setHeader('Content-Type', s3Data.ContentType || 'image/jpeg');
      res.setHeader('Cache-Control', 'public, max-age=31536000');
      fs.mkdirSync(localDir, { recursive: true });
      const writeStream = fs.createWriteStream(localPath);
      s3Data.Body.pipe(writeStream);
      return s3Data.Body.pipe(res);
    }
  } catch (err) {
    console.error(`S3 retrieval error for ${filename}:`, err.message);
  }

  return res.status(404).send('Image not found');
});

// Serve uploaded files statically so frontend can fetch them via /uploads/...
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// Swagger (OpenAPI) docs - enabled in non-production or when SWAGGER=true
setupSwagger(app);

app.use("/api/v1/message", messageRouter);
app.use("/api/v1/user", userRouter);
app.use("/api/v1/appointment", appointmentRouter);
app.use("/api/v1/medical", medicalAdviceRouter);
app.use("/api/v1/invoice", invoiceRouter);
app.use("/api/v1/reports", reportRouter);
app.use("/api/v1/medicine", medicineRouter);
app.use("/api/v1/hospital", hospitalRouter);
app.use("/api/v1/referral", referralRouter);
app.use("/api/v1/capacity-scheduler", capacityRouter);
app.use("/api/v1/doctor-capacity", capacityRouter);
app.use("/api/v1/template", templateRouter);
app.use("/api/v1/backup", backupRouter);
app.use("/api/v1/logs", logRouter);
app.use("/api/v1/test", testRouter);
app.use("/api/v1/advice", adviceRouter);
app.use("/api/v1/prescription", prescriptionRouter);

// Debug endpoint to inspect request cookies, headers and authenticated user.
// This is intentionally only enabled when not in production to avoid exposing internals.
app.get('/debug/auth', (req, res) => {
  if (process.env.NODE_ENV === 'production') return res.status(404).json({ success: false });
  return res.status(200).json({
    success: true,
    headers: req.headers,
    cookies: req.cookies || {},
    user: req.user || null,
  });
});

dbConnection();

app.use(errorMiddleware);
export default app;
