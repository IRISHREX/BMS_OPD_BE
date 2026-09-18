import express from "express";
import {
  getBackupStats,
  exportAppointmentsData,
  exportPatientsData,
  updateBackupSettings,
} from "../controller/backupController.js";
import { isDashboardAuthenticated } from "../middlewares/auth.js";

const router = express.Router();

router.get("/stats", isDashboardAuthenticated, getBackupStats);
router.get("/export/appointments", isDashboardAuthenticated, exportAppointmentsData);
router.get("/export/patients", isDashboardAuthenticated, exportPatientsData);
router.put("/settings", isDashboardAuthenticated, updateBackupSettings);

export default router;
