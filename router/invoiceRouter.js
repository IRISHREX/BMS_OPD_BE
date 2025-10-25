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
// settle all invoices for an appointment
router.post("/appointment/:id/settle", isDashboardAuthenticated, isAuthorized('Admin','Doctor','Compounder'), async (req, res, next) => {
  // delegate to controller handler
  const { id } = req.params;
  // forward to controller-level function
  const controller = await import('../controller/invoiceController.js');
  return controller.settleInvoicesForAppointment(req, res, next);
});
// stats endpoint: total earning, total due, grouped by day/week/month
router.get("/stats", isDashboardAuthenticated, getInvoiceStats);
// download invoice as HTML attachment
router.get("/:id/download", isDashboardAuthenticated, downloadInvoice);
router.get("/:id", isDashboardAuthenticated, getInvoice);
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
