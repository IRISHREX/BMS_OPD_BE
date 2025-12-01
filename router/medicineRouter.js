import express from "express";
import {
  addMedicine,
  getAllMedicines,
  updateMedicine,
  deleteMedicine,
  searchMedicineByName,
  searchMedicineByComposition,
} from "../controller/medicineController.js";
import {
  isAdminAuthenticated,
} from "../middlewares/auth.js";

const router = express.Router();

router.post("/add", isAdminAuthenticated, addMedicine);
router.get("/getall", getAllMedicines);
router.put("/update/:id", isAdminAuthenticated, updateMedicine);
router.delete("/delete/:id", isAdminAuthenticated, deleteMedicine);
router.get("/search/name", searchMedicineByName);
router.get("/search/composition", searchMedicineByComposition);

export default router;
