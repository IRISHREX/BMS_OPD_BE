import express from "express";
import {
  createOrUpdateTemplate,
  getMyTemplates,
  deleteTemplate,
} from "../controller/templateController.js";
import {
  isDashboardAuthenticated,
} from "../middlewares/auth.js";

const router = express.Router();

// IMPORTANT: specific routes must come before dynamic /:id routes
router.get("/my-templates", isDashboardAuthenticated, getMyTemplates);
router.post("/", isDashboardAuthenticated, createOrUpdateTemplate);        // create new
router.put("/:id", isDashboardAuthenticated, createOrUpdateTemplate);      // update existing
router.delete("/:id", isDashboardAuthenticated, deleteTemplate);

export default router;
