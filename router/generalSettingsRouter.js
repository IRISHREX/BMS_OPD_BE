import express from "express";
import {
  getGeneralSettings,
  updateGeneralSettings,
  saveAddressToStorage,
  deleteAddressFromStorage,
  updateSoundSettings,
  updateCommissionSettings,
} from "../controller/generalSettingsController.js";
import { uploadClinicImagesDisk } from "../middlewares/upload.js";

const router = express.Router();

router.get("/", getGeneralSettings);
router.post("/update", uploadClinicImagesDisk, updateGeneralSettings);
router.put("/", uploadClinicImagesDisk, updateGeneralSettings);

router.post("/save-address", saveAddressToStorage);
router.post("/delete-address", deleteAddressFromStorage);
router.post("/sound-settings", updateSoundSettings);
router.post("/commission-settings", updateCommissionSettings);

export default router;
