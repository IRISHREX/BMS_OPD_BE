import express from 'express';
import { getReportSummary, listReports, upsertReport, updateReport, deleteReport, getReportsByEmail } from '../controller/reportController.js';
import { isAdminAuthenticated, isDashboardAuthenticated, isAuthenticatedUser } from '../middlewares/auth.js';

const router = express.Router();

// Allow dashboard users to view reports; Admin can view all, doctors may be limited by controller using req.user
router.get('/summary', isDashboardAuthenticated, getReportSummary);

// persisted reports CRUD
router.get('/', isDashboardAuthenticated, listReports);
router.post('/', isAdminAuthenticated, upsertReport);
router.put('/:id', isAdminAuthenticated, updateReport);
router.delete('/:id', isAdminAuthenticated, deleteReport);

// Get reports by doctor or patient email
router.get('/by-email', isDashboardAuthenticated, getReportsByEmail);

export default router;
