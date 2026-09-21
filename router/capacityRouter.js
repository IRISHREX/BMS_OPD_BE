import express from "express";
import {
  setCapacity,
  setBulkCapacity,
  getCapacities,
  getDoctorCapacity,
  deleteCapacity,
} from "../controller/capacityController.js";
import { isDashboardAuthenticated } from "../middlewares/auth.js";

const router = express.Router();

router.get("/", isDashboardAuthenticated, getCapacities);
router.post("/set", isDashboardAuthenticated, setCapacity);
router.post("/set-bulk", isDashboardAuthenticated, setBulkCapacity);
router.get("/doctor/:doctorId", isDashboardAuthenticated, getDoctorCapacity);
router.delete("/:id", isDashboardAuthenticated, deleteCapacity);

export default router;
