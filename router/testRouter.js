import express from "express";
import {
  getAllTests,
  createTest,
  updateTest,
  deleteTest,
} from "../controller/testController.js";

const router = express.Router();

// Individual Tests
router.get("/", getAllTests);
router.post("/", createTest);
router.put("/:id", updateTest);
router.delete("/:id", deleteTest);

export default router;
