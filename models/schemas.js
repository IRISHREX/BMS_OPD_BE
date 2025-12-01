/**
 * @openapi
 * components:
 *   schemas:
 *     User:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *           format: ObjectId
 *         firstName:
 *           type: string
 *           minLength: 3
 *         lastName:
 *           type: string
 *           minLength: 3
 *         name:
 *           type: string
 *         email:
 *           type: string
 *           format: email
 *         phone:
 *           type: string
 *           minLength: 10
 *           maxLength: 11
 *         nic:
 *           type: string
 *           minLength: 13
 *           maxLength: 13
 *         dob:
 *           type: string
 *           format: date
 *         gender:
 *           type: string
 *           enum: ["Male", "Female", "Others"]
 *         age:
 *           type: number
 *           minimum: 0
 *         role:
 *           type: string
 *           enum: ["Patient", "Doctor", "Admin", "Compounder"]
 *         doctorDepartment:
 *           type: string
 *         qualifications:
 *           type: string
 *         consultationFee:
 *           type: number
 *           default: 100
 *         compounders:
 *           type: array
 *           items:
 *             type: string
 *             format: ObjectId
 *         assignedDoctors:
 *           type: array
 *           items:
 *             type: string
 *             format: ObjectId
 *       required:
 *         - firstName
 *         - lastName
 *         - email
 *         - phone
 *         - nic
 *         - dob
 *         - gender
 *         - role
 *
 *     Appointment:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *           format: ObjectId
 *         name:
 *           type: string
 *           minLength: 3
 *         email:
 *           type: string
 *           format: email
 *         phone:
 *           type: string
 *           minLength: 10
 *         age:
 *           type: number
 *         nic:
 *           type: string
 *         dob:
 *           type: string
 *           format: date
 *         gender:
 *           type: string
 *           enum: ["Male", "Female", "Others"]
 *         appointment_date:
 *           type: string
 *           format: date-time
 *         followup_date:
 *           type: string
 *           format: date-time
 *         department:
 *           type: string
 *         doctor:
 *           type: object
 *           properties:
 *             firstName:
 *               type: string
 *             lastName:
 *               type: string
 *         hasVisited:
 *           type: boolean
 *           default: false
 *         booked_by:
 *           type: string
 *           format: ObjectId
 *         book_by_name:
 *           type: string
 *         clinicalFindings:
 *           type: string
 *         provisionalDiagnosis:
 *           type: object
 *           properties:
 *             type:
 *               type: string
 *               enum: ["Provisional Diagnosis", "Diagnosis", "Differential Diagnosis"]
 *             value:
 *               type: string
 *         result:
 *           type: array
 *           items:
 *             type: object
 *         price:
 *           type: number
 *           default: 0
 *         paymentStatus:
 *           type: string
 *           enum: ["Pending", "Accepted", "Due", "Paid"]
 *           default: "Pending"
 *         status:
 *           type: string
 *           enum: ["Pending", "Accepted", "Rejected", "Completed"]
 *           default: "Pending"
 *         address:
 *           type: string
 *         profession:
 *           type: string
 *         doctorId:
 *           type: string
 *           format: ObjectId
 *         patientId:
 *           type: string
 *           format: ObjectId
 *         invoices:
 *           type: array
 *           items:
 *             type: string
 *             format: ObjectId
 *       required:
 *         - name
 *         - phone
 *         - gender
 *         - appointment_date
 *         - department
 *         - address
 *
 *     Invoice:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *           format: ObjectId
 *         invoiceNumber:
 *           type: string
 *           unique: true
 *         appointment:
 *           type: string
 *           format: ObjectId
 *         patient:
 *           type: string
 *           format: ObjectId
 *         doctor:
 *           type: string
 *           format: ObjectId
 *         items:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               description:
 *                 type: string
 *               quantity:
 *                 type: number
 *                 minimum: 1
 *               unitPrice:
 *                 type: number
 *                 minimum: 0
 *               total:
 *                 type: number
 *                 minimum: 0
 *         subtotal:
 *           type: number
 *           minimum: 0
 *           default: 0
 *         tax:
 *           type: number
 *           minimum: 0
 *           default: 0
 *         discount:
 *           type: number
 *           minimum: 0
 *           default: 0
 *         total:
 *           type: number
 *           minimum: 0
 *           default: 0
 *         status:
 *           type: string
 *           enum: ["Unpaid", "Paid", "Partial", "Cancelled"]
 *           default: "Unpaid"
 *         issuedAt:
 *           type: string
 *           format: date-time
 *         dueDate:
 *           type: string
 *           format: date-time
 *         payments:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               paidAt:
 *                 type: string
 *                 format: date-time
 *               amount:
 *                 type: number
 *               method:
 *                 type: string
 *               reference:
 *                 type: string
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 *       required:
 *         - invoiceNumber
 *
 *     Report:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *           format: ObjectId
 *         appointmentId:
 *           type: string
 *           format: ObjectId
 *         doctorId:
 *           type: string
 *           format: ObjectId
 *         patientId:
 *           type: string
 *           format: ObjectId
 *         appointmentDate:
 *           type: string
 *           format: date-time
 *         amount:
 *           type: number
 *           default: 0
 *         paid:
 *           type: number
 *           default: 0
 *         due:
 *           type: number
 *           default: 0
 *         revenue:
 *           type: number
 *           default: 0
 *         status:
 *           type: string
 *           enum: ["Due", "Paid", "Partial", "Adjusted"]
 *           default: "Due"
 *         notes:
 *           type: string
 *         createdBy:
 *           type: string
 *           format: ObjectId
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 *       required:
 *         - appointmentId
 *
 *     MedicalAdvice:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *           format: ObjectId
 *         name:
 *           type: string
 *         symptoms:
 *           type: array
 *           items:
 *             type: string
 *         medicines:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               type:
 *                 type: string
 *               dose:
 *                 type: string
 *               frequency:
 *                 type: string
 *               route:
 *                 type: string
 *               duration:
 *                 type: string
 *               notes:
 *                 type: string
 *         testAdvice:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               testName:
 *                 type: string
 *               testType:
 *                 type: string
 *               precautions:
 *                 type: string
 *               testDate:
 *                 type: string
 *         medication:
 *           type: string
 *         diet:
 *           type: string
 *         type:
 *           type: string
 *         route:
 *           type: string
 *         dose:
 *           type: string
 *         frequency:
 *           type: string
 *         duration:
 *           type: string
 *         aliases:
 *           type: array
 *           items:
 *             type: string
 *         tags:
 *           type: array
 *           items:
 *             type: string
 *         followup:
 *           type: object
 *           properties:
 *             days:
 *               type: number
 *             note:
 *               type: string
 *         desese_description:
 *           type: string
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 *       required:
 *         - name
 *
 *     Message:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *           format: ObjectId
 *         firstName:
 *           type: string
 *           minLength: 3
 *         lastName:
 *           type: string
 *           minLength: 3
 *         email:
 *           type: string
 *           format: email
 *         phone:
 *           type: string
 *           minLength: 10
 *           maxLength: 11
 *         message:
 *           type: string
 *           minLength: 10
 *         read:
 *           type: boolean
 *           default: false
 *         markedForDeletion:
 *           type: boolean
 *           default: false
 *         sentAt:
 *           type: string
 *           format: date-time
 *         recipient:
 *           type: string
 *           format: ObjectId
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 *       required:
 *         - firstName
 *         - lastName
 *         - email
 *         - phone
 *         - message
 */

// This file defines OpenAPI schema components for swagger-jsdoc
// It is scanned by swagger-jsdoc during initialization
export default {};
