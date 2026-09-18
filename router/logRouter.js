import express from "express";
import {
  getLogs,
  getLogStats,
  clearLogs,
  getLogSettings,
  updateLogSettings,
  markLogsDownloaded,
} from "../controller/logController.js";
import { isAdminAuthenticated } from "../middlewares/auth.js";

const router = express.Router();

// Strict Admin-only access as requested
router.get("/", isAdminAuthenticated, getLogs);
router.get("/stats", isAdminAuthenticated, getLogStats);
router.get("/settings", isAdminAuthenticated, getLogSettings);
router.put("/settings", isAdminAuthenticated, updateLogSettings);
router.post("/downloaded", isAdminAuthenticated, markLogsDownloaded);
router.delete("/clear", isAdminAuthenticated, clearLogs);

export default router;
