import express from "express";
import {
  getGeneralSettings,
  updateGeneralSettings,
} from "../controller/generalSettingsController.js";
import { uploadClinicImagesDisk } from "../middlewares/upload.js";

const router = express.Router();

router.get("/", getGeneralSettings);
router.post("/update", uploadClinicImagesDisk, updateGeneralSettings);
router.put("/", uploadClinicImagesDisk, updateGeneralSettings);

export default router;
