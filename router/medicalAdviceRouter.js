import express from "express";
import {
  createMedicalAdvice,
  getAllMedicalAdvice,
  getMedicalAdviceById,
  updateMedicalAdvice,
  deleteMedicalAdvice,
  searchMedicalAdvice,
  bulkCreateMedicalAdvice,
  getAllSuggestions,
  getSymptomsList,
  getAdvicesList,
  getTestsList,
  suggestQuery,
  analyzeSymptoms
} from "../controller/medicalAdviceController.js";

const router = express.Router();

router.post("/", createMedicalAdvice); // create
router.post("/bulk", bulkCreateMedicalAdvice); // bulk insert
router.get("/", getAllMedicalAdvice); // list
router.get("/search", searchMedicalAdvice); // search with query params
router.get("/suggestions/symptoms", getSymptomsList); // unique symptoms list
router.get("/suggestions/advices", getAdvicesList); // advices list with optional q
router.get("/suggestions/tests", getTestsList); // unique tests list
router.get("/suggestions/query", suggestQuery); // regex-based autosuggest with scoring
router.post("/analyze", analyzeSymptoms); // analyze a list of symptoms and propose aggregated suggestions
router.get("/:id", getMedicalAdviceById); // read
router.put("/:id", updateMedicalAdvice); // update
router.delete("/:id", deleteMedicalAdvice); // delete
router.get("/suggestions/all", getAllSuggestions); // all unique symptoms, names, medicine names


export default router;
