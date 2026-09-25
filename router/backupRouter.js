import express from "express";
import {
  getBackupStats,
  exportAppointmentsData,
  exportPatientsData,
  updateBackupSettings,
  backupToS3,
  getS3Backups,
} from "../controller/backupController.js";
import { isDashboardAuthenticated } from "../middlewares/auth.js";

const router = express.Router();

router.get("/stats", isDashboardAuthenticated, getBackupStats);
router.get("/export/appointments", isDashboardAuthenticated, exportAppointmentsData);
router.get("/export/patients", isDashboardAuthenticated, exportPatientsData);
router.put("/settings", isDashboardAuthenticated, updateBackupSettings);
router.post("/s3/trigger", isDashboardAuthenticated, backupToS3);
router.get("/s3/list", isDashboardAuthenticated, getS3Backups);

export default router;
