import express from 'express';
import { getReportSummary, listReports, upsertReport, updateReport, deleteReport, getReportsByEmail } from '../controller/reportController.js';
import { isAdminAuthenticated, isDashboardAuthenticated, isAuthenticatedUser } from '../middlewares/auth.js';

const router = express.Router();

/**
 * @openapi
 * /reports/summary:
 *   get:
 *     tags:
 *       - Report
 *     summary: Get report summary
 *     description: Retrieve a summary of reports (Dashboard users only)
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Report summary
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 totalReports:
 *                   type: number
 *                 totalRevenue:
 *                   type: number
 *                 totalDue:
 *                   type: number
 */
// Allow dashboard users to view reports; Admin can view all, doctors may be limited by controller using req.user
router.get('/summary', isDashboardAuthenticated, getReportSummary);

/**
 * @openapi
 * /reports:
 *   get:
 *     tags:
 *       - Report
 *     summary: List all reports
 *     description: Retrieve all reports (Dashboard users only)
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of reports
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Report'
 *   post:
 *     tags:
 *       - Report
 *     summary: Create or update report (Admin only)
 *     description: Create a new report or upsert existing report
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               appointmentId:
 *                 type: string
 *               doctorId:
 *                 type: string
 *               amount:
 *                 type: number
 *               paid:
 *                 type: number
 *               due:
 *                 type: number
 *               status:
 *                 type: string
 *                 enum: ["Due", "Paid", "Partial", "Adjusted"]
 *               notes:
 *                 type: string
 *     responses:
 *       201:
 *         description: Report created/upserted
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Report'
 *       403:
 *         description: Forbidden - Admin only
 */

// persisted reports CRUD
router.get('/', isDashboardAuthenticated, listReports);
router.post('/', isAdminAuthenticated, upsertReport);

/**
 * @openapi
 * /reports/{id}:
 *   put:
 *     tags:
 *       - Report
 *     summary: Update report (Admin only)
 *     description: Update an existing report
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Report updated
 *   delete:
 *     tags:
 *       - Report
 *     summary: Delete report (Admin only)
 *     description: Remove a report
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *     responses:
 *       200:
 *         description: Report deleted
 */
router.put('/:id', isAdminAuthenticated, updateReport);
router.delete('/:id', isAdminAuthenticated, deleteReport);

/**
 * @openapi
 * /reports/by-email:
 *   get:
 *     tags:
 *       - Report
 *     summary: Get reports by doctor or patient email
 *     description: Retrieve reports for a specific email address (Dashboard users only)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: email
 *         schema:
 *           type: string
 *           format: email
 *     responses:
 *       200:
 *         description: Reports for email
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Report'
 */

// Get reports by doctor or patient email
router.get('/by-email', isDashboardAuthenticated, getReportsByEmail);

export default router;
