import express from "express";
import {
  getLogs,
  getLogStats,
  clearLogs,
} from "../controller/logController.js";
import {
  isAdminAuthenticated,
  isDashboardAuthenticated,
} from "../middlewares/auth.js";

const router = express.Router();

router.get("/", isDashboardAuthenticated, getLogs);
router.get("/stats", isDashboardAuthenticated, getLogStats);
router.delete("/clear", isAdminAuthenticated, clearLogs);

export default router;
