import express from "express";
import {
  addNewAdmin,
  addNewDoctor,
  addNewCompounder,
  getAllDoctors,
  getUserDetails,
  login,
  logoutAdmin,
    getAllCompounders,
  logoutPatient,
  patientRegister,
  getPatientById,
  getPatientByNameOrPhone,
  updatePatientById,
  getDoctorById,
  getDoctorsList,
  getDoctorMe,
  getDashboardMe,
  getAllUsers,
  updateUserRole,
  deleteUserById,
  updateUserById,
  searchDoctor,
} from "../controller/userController.js";
import {
  isAdminAuthenticated,
  isPatientAuthenticated,
  isDashboardAuthenticated,
} from "../middlewares/auth.js";
import { uploadDoctorImagesDisk as uploadDoctorImages } from "../middlewares/upload.js";
const router = express.Router();

/**
 * @openapi
 * /user/patient/register:
 *   post:
 *     tags:
 *       - Patient
 *     summary: Register a new patient
 *     description: Create a new patient account with personal and contact details
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - firstName
 *               - lastName
 *               - email
 *               - phone
 *               - nic
 *               - dob
 *               - gender
 *               - password
 *             properties:
 *               firstName:
 *                 type: string
 *                 example: "John"
 *               lastName:
 *                 type: string
 *                 example: "Doe"
 *               email:
 *                 type: string
 *                 format: email
 *                 example: "john@example.com"
 *               phone:
 *                 type: string
 *                 example: "03001234567"
 *               nic:
 *                 type: string
 *                 example: "1234567890123"
 *               dob:
 *                 type: string
 *                 format: date
 *                 example: "1990-01-15"
 *               gender:
 *                 type: string
 *                 enum: ["Male", "Female", "Others"]
 *               password:
 *                 type: string
 *                 minLength: 8
 *                 example: "SecurePass123"
 *     responses:
 *       201:
 *         description: Patient registered successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   $ref: '#/components/schemas/User'
 *       400:
 *         description: Validation error or missing required fields
 */
router.post("/patient/register", patientRegister);

/**
 * @openapi
 * /user/login:
 *   post:
 *     tags:
 *       - Auth
 *     summary: Login user
 *     description: Authenticate a user (Patient, Doctor, Admin, or Compounder) and return JWT token
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: "user@example.com"
 *               password:
 *                 type: string
 *                 minLength: 8
 *                 example: "SecurePass123"
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     user:
 *                       $ref: '#/components/schemas/User'
 *                     token:
 *                       type: string
 *       401:
 *         description: Invalid email or password
 */
router.post("/login", login);//Login should not be restricted

/**
 * @openapi
 * /user/admin/addnew:
 *   post:
 *     tags:
 *       - Admin
 *     summary: Create a new admin user (Admin only)
 *     description: Add a new admin user to the system. Requires admin authentication.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - firstName
 *               - lastName
 *               - email
 *               - phone
 *               - nic
 *               - dob
 *               - gender
 *               - password
 *             properties:
 *               firstName:
 *                 type: string
 *                 example: "Admin"
 *               lastName:
 *                 type: string
 *                 example: "User"
 *               email:
 *                 type: string
 *                 format: email
 *               phone:
 *                 type: string
 *               nic:
 *                 type: string
 *               dob:
 *                 type: string
 *                 format: date
 *               gender:
 *                 type: string
 *                 enum: ["Male", "Female", "Others"]
 *               password:
 *                 type: string
 *                 minLength: 8
 *     responses:
 *       201:
 *         description: Admin created successfully
 *       403:
 *         description: Forbidden - Admin authentication required
 */
// Only Admins can create other Admins or Doctors
router.post("/admin/addnew", isAdminAuthenticated, addNewAdmin);

/**
 * @openapi
 * /user/compounder/addnew:
 *   post:
 *     tags:
 *       - Compounder
 *     summary: Create a new compounder (Dashboard users only)
 *     description: Add a new compounder to the system. Requires dashboard authentication.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - firstName
 *               - lastName
 *               - email
 *               - phone
 *               - nic
 *               - dob
 *               - gender
 *               - password
 *             properties:
 *               firstName:
 *                 type: string
 *               lastName:
 *                 type: string
 *               email:
 *                 type: string
 *                 format: email
 *               phone:
 *                 type: string
 *               nic:
 *                 type: string
 *               dob:
 *                 type: string
 *                 format: date
 *               gender:
 *                 type: string
 *                 enum: ["Male", "Female", "Others"]
 *               password:
 *                 type: string
 *                 minLength: 8
 *               assignedDoctors:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: IDs of doctors to assign to this compounder
 *     responses:
 *       201:
 *         description: Compounder created successfully
 *       403:
 *         description: Forbidden - Dashboard authentication required
 */
// Compounder creation allowed for Dashboard users but controller will enforce doctor-assignment rules
router.post('/compounder/addnew', isDashboardAuthenticated, addNewCompounder);

/**
 * @openapi
 * /user/doctor/addnew:
 *   post:
 *     tags:
 *       - Doctor
 *     summary: Create a new doctor (Admin only)
 *     description: Add a new doctor to the system with department and consultation fee
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - firstName
 *               - lastName
 *               - email
 *               - phone
 *               - nic
 *               - dob
 *               - gender
 *               - password
 *               - doctorDepartment
 *             properties:
 *               firstName:
 *                 type: string
 *               lastName:
 *                 type: string
 *               email:
 *                 type: string
 *                 format: email
 *               phone:
 *                 type: string
 *               nic:
 *                 type: string
 *               dob:
 *                 type: string
 *                 format: date
 *               gender:
 *                 type: string
 *                 enum: ["Male", "Female", "Others"]
 *               password:
 *                 type: string
 *                 minLength: 8
 *               doctorDepartment:
 *                 type: string
 *                 example: "Cardiology"
 *               qualifications:
 *                 type: string
 *                 example: "MBBS, MD"
 *               consultationFee:
 *                 type: number
 *                 default: 100
 *     responses:
 *       201:
 *         description: Doctor created successfully
 *       403:
 *         description: Forbidden - Admin authentication required
 */
// Only Admin can create doctors
router.post("/doctor/addnew", isAdminAuthenticated, uploadDoctorImages, addNewDoctor);

/**
 * @openapi
 * /user/doctors:
 *   get:
 *     tags:
 *       - Doctor
 *     summary: Get all doctors
 *     description: Retrieve a list of all doctors in the system
 *     responses:
 *       200:
 *         description: List of doctors
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/User'
 */
router.get("/doctors", getAllDoctors);

/**
 * @openapi
 * /user/doctor/me:
 *   get:
 *     tags:
 *       - Doctor
 *     summary: Get current doctor profile
 *     description: Retrieve the authenticated doctor's own profile details
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Doctor profile retrieved
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/User'
 *       401:
 *         description: Unauthorized - Bearer token required
 */
router.get('/doctor/me', isDashboardAuthenticated, getDoctorMe);

/**
 * @openapi
 * /user/dashboard/me:
 *   get:
 *     tags:
 *       - User
 *     summary: Get current dashboard user profile
 *     description: Retrieve the authenticated dashboard user's (Admin/Doctor/Compounder) profile
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Dashboard user profile retrieved
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 *       401:
 *         description: Unauthorized
 */
router.get('/dashboard/me',isDashboardAuthenticated, getDashboardMe);

/**
 * @openapi
 * /user/all:
 *   get:
 *     tags:
 *       - User
 *     summary: Get all users (Admin only)
 *     description: Retrieve a list of all users in the system
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of all users
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/User'
 *       403:
 *         description: Forbidden - Admin only
 */

// Role management (Admin only)

router.get('/all', isAdminAuthenticated, getAllUsers);

/**
 * @openapi
 * /user/role/{id}:
 *   put:
 *     tags:
 *       - User
 *     summary: Update user role (Admin only)
 *     description: Change the role of a user (Admin, Doctor, Patient, Compounder)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: User ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               role:
 *                 type: string
 *                 enum: ["Patient", "Doctor", "Admin", "Compounder"]
 *     responses:
 *       200:
 *         description: Role updated successfully
 *       403:
 *         description: Forbidden - Admin only
 */
router.put('/role/:id', isAdminAuthenticated, updateUserRole);

/**
 * @openapi
 * /user/user/{id}:
 *   put:
 *     tags:
 *       - User
 *     summary: Update user details (Admin only)
 *     description: Update user profile information (name, email, phone, etc.)
 *     security:
 *       - bearerAuth: []
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
 *             properties:
 *               firstName:
 *                 type: string
 *               lastName:
 *                 type: string
 *               email:
 *                 type: string
 *               phone:
 *                 type: string
 *               gender:
 *                 type: string
 *               doctorDepartment:
 *                 type: string
 *     responses:
 *       200:
 *         description: User updated successfully
 *   delete:
 *     tags:
 *       - User
 *     summary: Delete user (Admin only)
 *     description: Remove a user from the system
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *     responses:
 *       200:
 *         description: User deleted successfully
 *       403:
 *         description: Forbidden - Admin only
 */
router.put('/user/:id', isAdminAuthenticated, uploadDoctorImages, updateUserById);
router.delete('/user/:id', isAdminAuthenticated, deleteUserById);

/**
 * @openapi
 * /user/patient/me:
 *   get:
 *     tags:
 *       - Patient
 *     summary: Get current patient details
 *     description: Retrieve the authenticated patient's own profile
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Patient details retrieved
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 *       401:
 *         description: Unauthorized
 */
router.get("/patient/me", isPatientAuthenticated, getUserDetails);
router.get("/admin/me",isAdminAuthenticated, getUserDetails);

/**
 * @openapi
 * /user/patient/logout:
 *   get:
 *     tags:
 *       - Auth
 *     summary: Logout patient
 *     description: Log out the authenticated patient and clear session/tokens
 *     responses:
 *       200:
 *         description: Patient logged out successfully
 */
router.get("/patient/logout", logoutPatient);

/**
 * @openapi
 * /user/admin/logout:
 *   get:
 *     tags:
 *       - Auth
 *     summary: Logout admin
 *     description: Log out the authenticated admin and clear session/tokens
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Admin logged out successfully
 */
router.get("/admin/logout", logoutAdmin);

/**
 * @openapi
 * /user/patient/{id}:
 *   get:
 *     tags:
 *       - Patient
 *     summary: Get patient by ID
 *     description: Retrieve a specific patient's details by their ID
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: Patient ID
 *     responses:
 *       200:
 *         description: Patient details retrieved
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 *       404:
 *         description: Patient not found
 *   put:
 *     tags:
 *       - Patient
 *     summary: Update patient details
 *     description: Update a specific patient's information
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
 *             properties:
 *               firstName:
 *                 type: string
 *               lastName:
 *                 type: string
 *               email:
 *                 type: string
 *               phone:
 *                 type: string
 *               age:
 *                 type: number
 *               gender:
 *                 type: string
 *     responses:
 *       200:
 *         description: Patient updated successfully
 */

// Patient endpoints
router.get("/patient/:id", getPatientById);

/**
 * @openapi
 * /user/patient/search:
 *   get:
 *     tags:
 *       - Patient
 *     summary: Search patients by name or phone
 *     description: Find patients using partial name or phone number match
 *     parameters:
 *       - in: query
 *         name: q
 *         schema:
 *           type: string
 *         description: Search query (name or phone)
 *     responses:
 *       200:
 *         description: Matching patients
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/User'
 */
router.get("/patient/search", getPatientByNameOrPhone);
router.put("/patient/:id", updatePatientById);

/**
 * @openapi
 * /user/doctor/search:
 *   get:
 *     tags:
 *       - Doctor
 *     summary: Search doctors (Admin only)
 *     description: Find doctors by name, phone, department, or NIC using regex
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: q
 *         schema:
 *           type: string
 *         description: Search query
 *     responses:
 *       200:
 *         description: Matching doctors
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/User'
 *       403:
 *         description: Forbidden - Admin only
 */

// Doctor search by name, phone, department, NIC (regex)
router.get("/doctor/search", isAdminAuthenticated,searchDoctor);

/**
 * @openapi
 * /user/doctor/{id}:
 *   get:
 *     tags:
 *       - Doctor
 *     summary: Get doctor by ID
 *     description: Retrieve a specific doctor's details
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *     responses:
 *       200:
 *         description: Doctor details retrieved
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 */
router.get("/doctor/:id", getDoctorById);



/**
 * @openapi
 * /user/doctors/list:
 *   get:
 *     tags:
 *       - Doctor
 *     summary: Get doctors list
 *     description: Retrieve a formatted list of all doctors
 *     responses:
 *       200:
 *         description: Doctors list retrieved
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/User'
 */
router.get("/doctors/list", getDoctorsList);

/**
 * @openapi
 * /user/compounders:
 *   get:
 *     tags:
 *       - Compounder
 *     summary: Get all compounders (Admin only)
 *     description: Retrieve list of all compounders for dropdown/selection
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Compounders list retrieved
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/User'
 *       403:
 *         description: Forbidden - Admin only
 */
  // Get all compounders (for admin dropdown)
  router.get("/compounders", isAdminAuthenticated, getAllCompounders);

export default router;
