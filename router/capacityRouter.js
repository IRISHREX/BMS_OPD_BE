import express from "express";
import {
  setCapacity,
  getCapacities,
  getDoctorCapacity,
  deleteCapacity,
} from "../controller/capacityController.js";
import { isDashboardAuthenticated } from "../middlewares/auth.js";

const router = express.Router();

router.post("/set", isDashboardAuthenticated, setCapacity);
router.get("/", isDashboardAuthenticated, getCapacities);
router.get("/doctor/:doctorId", isDashboardAuthenticated, getDoctorCapacity);
router.delete("/:id", isDashboardAuthenticated, deleteCapacity);

export default router;
