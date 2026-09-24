import express from "express";
import { savePrescription, getLatestPrescriptions, getPrescriptionById, searchPrescriptions } from "../controller/prescriptionController.js";
import { isAuthenticatedUser } from "../middlewares/auth.js";

const router = express.Router();

router.post("/save", savePrescription);
router.get("/patient/:id", getLatestPrescriptions);
router.get("/search", searchPrescriptions);
router.get("/:id", getPrescriptionById);

export default router;
