import express from "express";
import {
  deleteAppointment,
  getAllAppointments,
  getAppointmentsByPatientId,
  postAppointment,
  searchAppointments,
  updateAppointmentByPatientId,
  updateAppointmentStatus,
  bulkDeleteAppointments,
  deleteAppointmentsByPatientId,
} from "../controller/appointmentController.js";
import {
  isAdminAuthenticated,
  isPatientAuthenticated,
  isAuthenticatedUser,
  isDashboardAuthenticated,
} from "../middlewares/auth.js";

const router = express.Router();

// router.post("/post", postAppointment);
// Only dashboard users (Admin/Doctor/Compounder) may create appointments via dashboard
router.post("/post",isDashboardAuthenticated,postAppointment);
router.get("/getall", getAllAppointments);
router.get("/patient/:id", getAppointmentsByPatientId);
router.get("/search", searchAppointments);
router.put("/update/:id", isAdminAuthenticated, updateAppointmentStatus);
// allow authenticated users (doctors/patients/admin) to update appointment by appointment id
router.put("/status/:id", updateAppointmentStatus);
router.put("/patient/update/:id", updateAppointmentByPatientId);
router.delete("/delete/:id", isAdminAuthenticated, deleteAppointment);

// Bulk delete appointments by IDs
router.post("/bulk-delete", isAdminAuthenticated, bulkDeleteAppointments);

// Delete all appointments for a patient
router.delete("/delete/patient/:patientId", isAdminAuthenticated, deleteAppointmentsByPatientId);

export default router;
