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
const router = express.Router();

router.post("/patient/register", patientRegister);
router.post("/login", login);//Login should not be restricted
// Only Admins can create other Admins or Doctors
router.post("/admin/addnew", isAdminAuthenticated, addNewAdmin);
// Compounder creation allowed for Dashboard users but controller will enforce doctor-assignment rules
router.post('/compounder/addnew', isDashboardAuthenticated, addNewCompounder);
// Only Admin can create doctors
router.post("/doctor/addnew", isAdminAuthenticated, addNewDoctor);
router.get("/doctors", getAllDoctors);
router.get('/doctor/me', isDashboardAuthenticated, getDoctorMe);
router.get('/dashboard/me',isDashboardAuthenticated, getDashboardMe);

// Role management (Admin only)

router.get('/all', isAdminAuthenticated, getAllUsers);
router.put('/role/:id', isAdminAuthenticated, updateUserRole);
router.put('/user/:id', isAdminAuthenticated, updateUserById);
router.delete('/user/:id', isAdminAuthenticated, deleteUserById);
router.get("/patient/me", isPatientAuthenticated, getUserDetails);
router.get("/admin/me",isAdminAuthenticated, getUserDetails);
router.get("/patient/logout", logoutPatient);
router.get("/admin/logout", logoutAdmin);

// Patient endpoints
router.get("/patient/:id", getPatientById);
router.get("/patient/search", getPatientByNameOrPhone);
router.put("/patient/:id", updatePatientById);

// Doctor search by name, phone, department, NIC (regex)
router.get("/doctor/search", isAdminAuthenticated,searchDoctor);
router.get("/doctor/:id", getDoctorById);
router.get("/doctors/list", getDoctorsList);
  // Get all compounders (for admin dropdown)
  router.get("/compounders", isAdminAuthenticated, getAllCompounders);

export default router;
