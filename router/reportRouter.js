import express from 'express';
import { getReportSummary } from '../controller/reportController.js';
import { isAdminAuthenticated, isDashboardAuthenticated, isAuthenticatedUser } from '../middlewares/auth.js';

const router = express.Router();

// Allow dashboard users to view reports; Admin can view all, doctors may be limited by controller using req.user
router.get('/summary', isDashboardAuthenticated, getReportSummary);

export default router;
