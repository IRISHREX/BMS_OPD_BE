import express from "express";
import {
  savePrescription,
  getLatestPrescriptions,
  getPrescriptionById,
  searchPrescriptions,
  savePrescriptionPdf,
  listPrescriptionPdfs,
} from "../controller/prescriptionController.js";
import { isAuthenticatedUser } from "../middlewares/auth.js";

const router = express.Router();

router.post("/save", savePrescription);
router.get("/patient/:id", getLatestPrescriptions);
router.get("/search", searchPrescriptions);

// PDF management – must come before /:id generic route
router.post(
  "/pdf/:prescriptionId",
  express.raw({ type: "application/pdf", limit: "20mb" }),
  savePrescriptionPdf
);
router.get("/pdf-list/:patientId", listPrescriptionPdfs);

router.get("/:id", getPrescriptionById);

export default router;
