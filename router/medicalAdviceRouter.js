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
  analyzeSymptoms,
  searchDiseaseBySymptoms,
  advanceSearchBySymptoms,
} from "../controller/medicalAdviceController.js";

const router = express.Router();

/**
 * @openapi
 * /medical:
 *   post:
 *     tags:
 *       - Medical Advice
 *     summary: Create medical advice
 *     description: Create a new medical advice entry for disease management
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *             properties:
 *               name:
 *                 type: string
 *                 example: "Diabetes"
 *               symptoms:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: ["Thirst", "Fatigue"]
 *               medicines:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     name:
 *                       type: string
 *                     dose:
 *                       type: string
 *                     frequency:
 *                       type: string
 *               testAdvice:
 *                 type: array
 *                 items:
 *                   type: object
 *               diet:
 *                 type: string
 *               medication:
 *                 type: string
 *     responses:
 *       201:
 *         description: Medical advice created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/MedicalAdvice'
 */
router.post("/", createMedicalAdvice); // create

/**
 * @openapi
 * /medical/bulk:
 *   post:
 *     tags:
 *       - Medical Advice
 *     summary: Bulk create medical advice
 *     description: Create multiple medical advice entries at once
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               items:
 *                 type: array
 *                 items:
 *                   type: object
 *     responses:
 *       201:
 *         description: Bulk create completed
 */
router.post("/bulk", bulkCreateMedicalAdvice); // bulk insert

/**
 * @openapi
 * /medical:
 *   get:
 *     tags:
 *       - Medical Advice
 *     summary: Get all medical advice
 *     description: Retrieve all medical advice entries
 *     responses:
 *       200:
 *         description: List of medical advice
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/MedicalAdvice'
 */
router.get("/", getAllMedicalAdvice); // list

/**
 * @openapi
 * /medical/search:
 *   get:
 *     tags:
 *       - Medical Advice
 *     summary: Search medical advice
 *     description: Search medical advice by query parameters
 *     parameters:
 *       - in: query
 *         name: q
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Matching medical advice
 */
router.get("/search", searchMedicalAdvice); // search with query params

/**
 * @openapi
 * /medical/search-disease:
 *   get:
 *     tags:
 *       - Medical Advice
 *     summary: Search diseases by symptoms
 *     description: Find diseases based on provided symptoms
 *     parameters:
 *       - in: query
 *         name: symptoms
 *         schema:
 *           type: array
 *           items:
 *             type: string
 *     responses:
 *       200:
 *         description: Matching diseases
 */
router.get("/search-disease", searchDiseaseBySymptoms); // search diseases by symptoms

/**
 * @openapi
 * /medical/advance-search-symptoms:
 *   get:
 *     tags:
 *       - Medical Advice
 *     summary: Advanced symptom search
 *     description: Advanced search using symptom criteria
 *     parameters:
 *       - in: query
 *         name: symptoms
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Search results
 */
router.get("/advance-search-symptoms", advanceSearchBySymptoms); // new advanced search

/**
 * @openapi
 * /medical/suggestions/symptoms:
 *   get:
 *     tags:
 *       - Medical Advice
 *     summary: Get symptoms list
 *     description: Retrieve list of unique symptoms
 *     responses:
 *       200:
 *         description: List of symptoms
 */
router.get("/suggestions/symptoms", getSymptomsList); // unique symptoms list

/**
 * @openapi
 * /medical/suggestions/advices:
 *   get:
 *     tags:
 *       - Medical Advice
 *     summary: Get advices list
 *     description: Retrieve list of medical advices
 *     parameters:
 *       - in: query
 *         name: q
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of advices
 */
router.get("/suggestions/advices", getAdvicesList); // advices list with optional q

/**
 * @openapi
 * /medical/suggestions/tests:
 *   get:
 *     tags:
 *       - Medical Advice
 *     summary: Get tests list
 *     description: Retrieve list of unique tests
 *     responses:
 *       200:
 *         description: List of tests
 */
router.get("/suggestions/tests", getTestsList); // unique tests list

/**
 * @openapi
 * /medical/suggestions/query:
 *   get:
 *     tags:
 *       - Medical Advice
 *     summary: Suggest query
 *     description: Regex-based autosuggest with scoring
 *     parameters:
 *       - in: query
 *         name: q
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Suggestions
 */
router.get("/suggestions/query", suggestQuery); // regex-based autosuggest with scoring

/**
 * @openapi
 * /medical/analyze:
 *   post:
 *     tags:
 *       - Medical Advice
 *     summary: Analyze symptoms
 *     description: Analyze a list of symptoms and propose aggregated suggestions
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               symptoms:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Analysis results
 */
router.post("/analyze", analyzeSymptoms); // analyze a list of symptoms and propose aggregated suggestions

/**
 * @openapi
 * /medical/{id}:
 *   get:
 *     tags:
 *       - Medical Advice
 *     summary: Get medical advice by ID
 *     description: Retrieve a specific medical advice entry
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *     responses:
 *       200:
 *         description: Medical advice details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/MedicalAdvice'
 *   put:
 *     tags:
 *       - Medical Advice
 *     summary: Update medical advice
 *     description: Update an existing medical advice entry
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Medical advice updated
 *   delete:
 *     tags:
 *       - Medical Advice
 *     summary: Delete medical advice
 *     description: Remove a medical advice entry
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *     responses:
 *       200:
 *         description: Medical advice deleted
 */
router.get("/:id", getMedicalAdviceById); // read
router.put("/:id", updateMedicalAdvice); // update
router.delete("/:id", deleteMedicalAdvice); // delete

/**
 * @openapi
 * /medical/suggestions/all:
 *   get:
 *     tags:
 *       - Medical Advice
 *     summary: Get all suggestions
 *     description: Get all unique symptoms, names, and medicine names
 *     responses:
 *       200:
 *         description: All suggestions data
 */
router.get("/suggestions/all", getAllSuggestions); // all unique symptoms, names, medicine names


export default router;
