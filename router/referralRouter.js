import express from "express";
import {
  createReferral,
  bookPatientReferral,
  convertToAppointment,
  getAllReferrals,
  getReferralById,
  updateReferral,
  deleteReferral,
  getReferralsByPatient,
  getReferralsByHospital,
  getReferralsByDoctor,
  updateReferralStatus,
  searchReferrals,
  getReferralByNumber,
  getReferralStatistics,
} from "../controller/referralController.js";
import { isDashboardAuthenticated } from "../middlewares/auth.js";

const router = express.Router();

// Public / Patient Booking: Book appointment as an inbound referral for a doctor
router.post("/book", bookPatientReferral);

// Convert Inbound Referral to Official Appointment (Admin, Doctor, Compounder)
router.post("/:id/convert-to-appointment", isDashboardAuthenticated, convertToAppointment);
router.post("/convert-to-appointment/:id", isDashboardAuthenticated, convertToAppointment);

// Create referral (Doctor outbound referral to hospital/clinic)
router.post("/create", isDashboardAuthenticated, createReferral);

// Get all referrals with filters
router.get("/all", isDashboardAuthenticated, getAllReferrals);
router.get("/getall", isDashboardAuthenticated, getAllReferrals);

// Search referrals
router.get("/search", isDashboardAuthenticated, searchReferrals);

// Get statistics
router.get("/statistics", isDashboardAuthenticated, getReferralStatistics);

// Get by referral number
router.get("/number/:referralNumber", isDashboardAuthenticated, getReferralByNumber);

// Get referrals by patient
router.get("/patient/:patientId", isDashboardAuthenticated, getReferralsByPatient);

// Get referrals by hospital
router.get("/hospital/:hospitalId", isDashboardAuthenticated, getReferralsByHospital);

// Get referrals by doctor
router.get("/doctor/:doctorId", isDashboardAuthenticated, getReferralsByDoctor);

// Get single referral by ID
router.get("/:id", isDashboardAuthenticated, getReferralById);

// Update referral
router.put("/update/:id", isDashboardAuthenticated, updateReferral);

// Update referral status (hospital/admin can update)
router.put("/:id/status", isDashboardAuthenticated, updateReferralStatus);

// Delete referral (only admin)
router.delete("/delete/:id", isDashboardAuthenticated, deleteReferral);

export default router;
