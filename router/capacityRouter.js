import express from "express";
import { setCapacity, getCapacities } from "../controller/capacityController.js";
import { isDashboardAuthenticated } from "../middlewares/auth.js";

const router = express.Router();

router.post("/set", isDashboardAuthenticated, setCapacity);
router.get("/", isDashboardAuthenticated, getCapacities);

export default router;
