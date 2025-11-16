import express from "express";
import {
  createInvoice,
  getInvoice,
  listInvoices,
  updateInvoice,
  deleteInvoice,
  searchInvoices,
  getInvoicesByAppointment,
  getInvoiceStats,
  updateInvoicesByAppointment,
  downloadInvoice,
  getInvoicesByEmail,
} from "../controller/invoiceController.js";
import { isAuthenticatedUser, isDashboardAuthenticated, isAuthorized } from "../middlewares/auth.js";

const router = express.Router();

/**
 * @openapi
 * /invoice:
 *   post:
 *     tags:
 *       - Invoice
 *     summary: Create a new invoice
 *     description: Create an invoice for an appointment (Dashboard users - Admin/Doctor/Compounder)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - invoiceNumber
 *               - appointment
 *             properties:
 *               invoiceNumber:
 *                 type: string
 *                 example: "INV-001"
 *               appointment:
 *                 type: string
 *                 description: Appointment ID
 *               doctor:
 *                 type: string
 *               items:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     description:
 *                       type: string
 *                     quantity:
 *                       type: number
 *                     unitPrice:
 *                       type: number
 *                     total:
 *                       type: number
 *               tax:
 *                 type: number
 *               discount:
 *                 type: number
 *               dueDate:
 *                 type: string
 *                 format: date
 *     responses:
 *       201:
 *         description: Invoice created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Invoice'
 *       403:
 *         description: Forbidden
 */
// Dashboard users (Admin/Doctor) can create invoices via dashboard
router.post("/", isDashboardAuthenticated, isAuthorized('Admin','Doctor','Compounder'), createInvoice);

/**
 * @openapi
 * /invoice:
 *   get:
 *     tags:
 *       - Invoice
 *     summary: List all invoices
 *     description: Retrieve all invoices (Dashboard users only)
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of invoices
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Invoice'
 *       403:
 *         description: Forbidden
 */

// Public listing and search protected by dashboard auth
router.get("/", isDashboardAuthenticated, listInvoices);

/**
 * @openapi
 * /invoice/search:
 *   get:
 *     tags:
 *       - Invoice
 *     summary: Search invoices
 *     description: Search invoices by criteria
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: q
 *         schema:
 *           type: string
 *         description: Search query
 *     responses:
 *       200:
 *         description: Matching invoices
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Invoice'
 */
router.get("/search", isDashboardAuthenticated, searchInvoices);

/**
 * @openapi
 * /invoice/appointment/{id}:
 *   get:
 *     tags:
 *       - Invoice
 *     summary: Get invoices by appointment ID
 *     description: Retrieve all invoices for a specific appointment
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
 *         description: Invoices for the appointment
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Invoice'
 *   put:
 *     tags:
 *       - Invoice
 *     summary: Update invoices for an appointment
 *     description: Update or create invoices for an appointment
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
 *         description: Invoices updated successfully
 */
// get invoices by appointment id
router.get("/appointment/:id", isDashboardAuthenticated, getInvoicesByAppointment);
// update invoices for an appointment
router.put("/appointment/:id", isDashboardAuthenticated, updateInvoicesByAppointment);

/**
 * @openapi
 * /invoice/appointment/{id}/settle:
 *   post:
 *     tags:
 *       - Invoice
 *     summary: Settle all invoices for an appointment
 *     description: Mark all invoices for an appointment as settled/paid
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
 *         description: Invoices settled successfully
 */
// settle all invoices for an appointment
router.post("/appointment/:id/settle", isDashboardAuthenticated, isAuthorized('Admin','Doctor','Compounder'), async (req, res, next) => {
  // delegate to controller handler
  const { id } = req.params;
  // forward to controller-level function
  const controller = await import('../controller/invoiceController.js');
  return controller.settleInvoicesForAppointment(req, res, next);
});

/**
 * @openapi
 * /invoice/stats:
 *   get:
 *     tags:
 *       - Invoice
 *     summary: Get invoice statistics
 *     description: Get total earnings, due amounts, grouped by day/week/month
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Invoice statistics
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 totalEarnings:
 *                   type: number
 *                 totalDue:
 *                   type: number
 *                 byPeriod:
 *                   type: object
 */
// stats endpoint: total earning, total due, grouped by day/week/month
router.get("/stats", isDashboardAuthenticated, getInvoiceStats);

/**
 * @openapi
 * /invoice/{id}/download:
 *   get:
 *     tags:
 *       - Invoice
 *     summary: Download invoice as HTML
 *     description: Download or view invoice as an HTML document/attachment
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
 *         description: Invoice HTML file
 */
// download invoice as HTML attachment
router.get("/:id/download", isDashboardAuthenticated, downloadInvoice);

/**
 * @openapi
 * /invoice/{id}:
 *   get:
 *     tags:
 *       - Invoice
 *     summary: Get invoice by ID
 *     description: Retrieve a specific invoice
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
 *         description: Invoice details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Invoice'
 *   put:
 *     tags:
 *       - Invoice
 *     summary: Update invoice
 *     description: Update invoice details
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
 *         description: Invoice updated
 *   delete:
 *     tags:
 *       - Invoice
 *     summary: Delete invoice (Admin only)
 *     description: Remove an invoice
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
 *         description: Invoice deleted
 */
router.get("/:id", isDashboardAuthenticated, getInvoice);
// Get invoices by doctor or patient email
router.get("/by-email", isDashboardAuthenticated, getInvoicesByEmail);
// settle invoice (make payment for remaining due)
router.post("/:id/settle", isDashboardAuthenticated, isAuthorized('Admin','Doctor','Compounder'), async (req, res, next) => {
  // delegated to controller implementation via updateInvoice (keeps single change point)
  // but keep route for explicit settle action
  const { id } = req.params;
  req.body._settle = true;
  return updateInvoice(req, res, next);
});
router.put("/:id", isDashboardAuthenticated, isAuthorized('Admin','Doctor','Compounder'), updateInvoice);
router.delete("/:id", isDashboardAuthenticated, isAuthorized('Admin'), deleteInvoice);

export default router;
