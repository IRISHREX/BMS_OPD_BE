import express from "express";
import {
  getAllTests,
  createTest,
  updateTest,
  deleteTest,
  getAllTestTemplates,
  createTestTemplate,
  updateTestTemplate,
  deleteTestTemplate,
} from "../controller/testController.js";

const router = express.Router();

// Individual Tests
router.get("/", getAllTests);
router.post("/", createTest);
router.put("/:id", updateTest);
router.delete("/:id", deleteTest);

// Test Templates / Profiles
router.get("/templates/all", getAllTestTemplates);
router.post("/templates", createTestTemplate);
router.put("/templates/:id", updateTestTemplate);
router.delete("/templates/:id", deleteTestTemplate);

export default router;
