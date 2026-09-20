import express from "express";
import {
  getAllAdvices,
  createAdvice,
  updateAdvice,
  deleteAdvice,
} from "../controller/adviceController.js";

const router = express.Router();

router.get("/", getAllAdvices);
router.post("/", createAdvice);
router.put("/:id", updateAdvice);
router.delete("/:id", deleteAdvice);

export default router;
