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
} from "../controller/invoiceController.js";
import { isAuthenticatedUser, isDashboardAuthenticated, isAuthorized } from "../middlewares/auth.js";

const router = express.Router();

// Dashboard users (Admin/Doctor) can create invoices via dashboard
router.post("/", isDashboardAuthenticated, isAuthorized('Admin','Doctor','Compounder'), createInvoice);

// Public listing and search protected by dashboard auth
router.get("/", isDashboardAuthenticated, listInvoices);
router.get("/search", isDashboardAuthenticated, searchInvoices);
// get invoices by appointment id
router.get("/appointment/:id", isDashboardAuthenticated, getInvoicesByAppointment);
// update invoices for an appointment
router.put("/appointment/:id", isDashboardAuthenticated, updateInvoicesByAppointment);
// stats endpoint: total earning, total due, grouped by day/week/month
router.get("/stats", isDashboardAuthenticated, getInvoiceStats);
// download invoice as HTML attachment
router.get("/:id/download", isDashboardAuthenticated, downloadInvoice);
router.get("/:id", isDashboardAuthenticated, getInvoice);
router.put("/:id", isDashboardAuthenticated, isAuthorized('Admin','Doctor','Compounder'), updateInvoice);
router.delete("/:id", isDashboardAuthenticated, isAuthorized('Admin'), deleteInvoice);

export default router;
