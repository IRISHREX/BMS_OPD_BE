import express from "express";
import {
  getTemplates,
  getTemplate,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  getTemplatesByCategory,
  saveClinicalFindings,
  getClinicalFindings,
  getDefaultTemplatesByCategory,
} from "../controller/clinicalFindingsController.js";
import { isAuthenticatedUser } from "../middlewares/auth.js";

const router = express.Router();

// Template Routes
router.get("/templates/:doctorId", isAuthenticatedUser, getTemplates);
router.get("/template/:templateId", isAuthenticatedUser, getTemplate);
router.post("/template/create", isAuthenticatedUser, createTemplate);
router.put("/template/:templateId", isAuthenticatedUser, updateTemplate);
router.delete("/template/:templateId", isAuthenticatedUser, deleteTemplate);
router.get("/templates/category/:doctorId/:category", isAuthenticatedUser, getTemplatesByCategory);
router.get("/default-templates/:category", getDefaultTemplatesByCategory);

// Clinical Findings Routes
router.post("/findings/save", isAuthenticatedUser, saveClinicalFindings);
router.get("/findings/:appointmentId", isAuthenticatedUser, getClinicalFindings);

export default router;

