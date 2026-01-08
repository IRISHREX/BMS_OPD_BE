import express from "express";
import {
  createReferral,
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

// Create referral (protected)
router.post("/create", isDashboardAuthenticated, createReferral);

// Get all referrals with filters
router.get("/all", isDashboardAuthenticated, getAllReferrals);

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
