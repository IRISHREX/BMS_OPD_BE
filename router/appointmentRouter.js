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
  suggestPatients,
} from "../controller/appointmentController.js";
import {
  isAdminAuthenticated,
  isPatientAuthenticated,
  isAuthenticatedUser,
  isDashboardAuthenticated,
} from "../middlewares/auth.js";

const router = express.Router();

/**
 * @openapi
 * /appointment/post:
 *   post:
 *     tags:
 *       - Appointment
 *     summary: Create a new appointment
 *     description: Schedule a new appointment (Dashboard users only - Admin/Doctor/Compounder)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - phone
 *               - gender
 *               - appointment_date
 *               - department
 *               - doctorId
 *               - address
 *             properties:
 *               name:
 *                 type: string
 *                 example: "John Doe"
 *               email:
 *                 type: string
 *                 format: email
 *               phone:
 *                 type: string
 *                 example: "03001234567"
 *               age:
 *                 type: number
 *               gender:
 *                 type: string
 *                 enum: ["Male", "Female", "Others"]
 *               appointment_date:
 *                 type: string
 *                 format: date-time
 *               department:
 *                 type: string
 *                 example: "Cardiology"
 *               doctorId:
 *                 type: string
 *                 description: ID of the assigned doctor
 *               address:
 *                 type: string
 *               price:
 *                 type: number
 *                 default: 0
 *     responses:
 *       201:
 *         description: Appointment created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Appointment'
 *       403:
 *         description: Forbidden - Dashboard users only
 */
// Only dashboard users (Admin/Doctor/Compounder) may create appointments via dashboard
router.post("/post",isDashboardAuthenticated,postAppointment);

/**
 * @openapi
 * /appointment/getall:
 *   get:
 *     tags:
 *       - Appointment
 *     summary: Get all appointments
 *     description: Retrieve a list of all appointments in the system
 *     responses:
 *       200:
 *         description: List of all appointments
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Appointment'
 */
router.get("/getall", getAllAppointments);

/**
 * @openapi
 * /appointment/patient/{id}:
 *   get:
 *     tags:
 *       - Appointment
 *     summary: Get appointments by patient ID
 *     description: Retrieve all appointments for a specific patient
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: Patient ID
 *     responses:
 *       200:
 *         description: List of patient's appointments
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Appointment'
 */
router.get("/patient/:id", getAppointmentsByPatientId);

/**
 * @openapi
 * /appointment/search:
 *   get:
 *     tags:
 *       - Appointment
 *     summary: Search appointments
 *     description: Search appointments by various criteria
 *     parameters:
 *       - in: query
 *         name: q
 *         schema:
 *           type: string
 *         description: Search query
 *     responses:
 *       200:
 *         description: Matching appointments
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Appointment'
 */
router.get("/search", searchAppointments);

/**
 * @openapi
 * /appointment/suggest:
 *   get:
 *     tags:
 *       - Appointment
 *     summary: Suggest patients for appointment
 *     description: Get patient suggestions for booking appointment by partial name/phone/email
 *     parameters:
 *       - in: query
 *         name: q
 *         schema:
 *           type: string
 *         description: Partial name, phone, email, or address
 *     responses:
 *       200:
 *         description: Matching patient suggestions
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   _id:
 *                     type: string
 *                   name:
 *                     type: string
 *                   phone:
 *                     type: string
 */
// Suggest patients by partial name/phone/email/address for booking autosuggest
router.get("/suggest", suggestPatients);

/**
 * @openapi
 * /appointment/update/{id}:
 *   put:
 *     tags:
 *       - Appointment
 *     summary: Update appointment status (Admin only)
 *     description: Update the status of an appointment (requires admin auth)
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
 *             properties:
 *               status:
 *                 type: string
 *                 enum: ["Pending", "Accepted", "Rejected", "Completed"]
 *     responses:
 *       200:
 *         description: Appointment status updated
 *       403:
 *         description: Forbidden - Admin only
 */
router.put("/update/:id", isAdminAuthenticated, updateAppointmentStatus);

/**
 * @openapi
 * /appointment/status/{id}:
 *   put:
 *     tags:
 *       - Appointment
 *     summary: Update appointment status
 *     description: Update appointment status (authenticated users - doctors/patients/admin)
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
 *             properties:
 *               status:
 *                 type: string
 *                 enum: ["Pending", "Accepted", "Rejected", "Completed"]
 *     responses:
 *       200:
 *         description: Appointment status updated
 */
// allow authenticated users (doctors/patients/admin) to update appointment by appointment id
router.put("/status/:id", updateAppointmentStatus);

/**
 * @openapi
 * /appointment/patient/update/{id}:
 *   put:
 *     tags:
 *       - Appointment
 *     summary: Update appointment by patient
 *     description: Update appointment details (clinical findings, diagnosis, etc.)
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
 *             properties:
 *               clinicalFindings:
 *                 type: string
 *               provisionalDiagnosis:
 *                 type: object
 *               result:
 *                 type: array
 *     responses:
 *       200:
 *         description: Appointment updated successfully
 */
router.put("/patient/update/:id", updateAppointmentByPatientId);

/**
 * @openapi
 * /appointment/delete/{id}:
 *   delete:
 *     tags:
 *       - Appointment
 *     summary: Delete appointment (Admin only)
 *     description: Remove an appointment from the system
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
 *         description: Appointment deleted successfully
 *       403:
 *         description: Forbidden - Admin only
 */
router.delete("/delete/:id", isAdminAuthenticated, deleteAppointment);

/**
 * @openapi
 * /appointment/bulk-delete:
 *   post:
 *     tags:
 *       - Appointment
 *     summary: Bulk delete appointments (Admin only)
 *     description: Delete multiple appointments by their IDs
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               ids:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Appointments deleted successfully
 *       403:
 *         description: Forbidden - Admin only
 */

// Bulk delete appointments by IDs
router.post("/bulk-delete", isAdminAuthenticated, bulkDeleteAppointments);

/**
 * @openapi
 * /appointment/delete/patient/{patientId}:
 *   delete:
 *     tags:
 *       - Appointment
 *     summary: Delete all appointments for a patient (Admin only)
 *     description: Remove all appointments associated with a specific patient
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: patientId
 *         schema:
 *           type: string
 *         required: true
 *     responses:
 *       200:
 *         description: Patient appointments deleted successfully
 *       403:
 *         description: Forbidden - Admin only
 */

// Delete all appointments for a patient
router.delete("/delete/patient/:patientId", isAdminAuthenticated, deleteAppointmentsByPatientId);

export default router;
