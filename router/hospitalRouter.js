import express from "express";
import {
  createHospital,
  getAllHospitals,
  getHospitalById,
  updateHospital,
  deleteHospital,
  toggleHospitalStatus,
  toggleHospitalBlock,
  searchHospitals,
  addDoctorToHospital,
  removeDoctorFromHospital,
  getHospitalsBySpecialty,
} from "../controller/hospitalController.js";
import { isDashboardAuthenticated } from "../middlewares/auth.js";

const router = express.Router();

// Public routes
router.get("/all", getAllHospitals);
router.get("/search", searchHospitals);
router.get("/specialty/:specialty", getHospitalsBySpecialty);
router.get("/:id", getHospitalById);

// Admin/Doctor routes (protected)
router.post("/create", isDashboardAuthenticated,  createHospital);
router.put("/update/:id", isDashboardAuthenticated, updateHospital);
router.delete("/delete/:id", isDashboardAuthenticated, deleteHospital);

// Status management
router.put("/toggle-status/:id", isDashboardAuthenticated, toggleHospitalStatus);
router.put("/toggle-block/:id", isDashboardAuthenticated, toggleHospitalBlock);

// Doctor management
router.post("/:id/doctor/add", isDashboardAuthenticated, addDoctorToHospital);
router.delete("/:id/doctor/:doctorIndex", isDashboardAuthenticated, removeDoctorFromHospital);
export default router;
