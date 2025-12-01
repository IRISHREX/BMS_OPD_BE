import express from "express";
import {
  getAllMessages,
  sendMessage,
  updateMessage,
  deleteMessageById,
  bulkDeleteMessages,
  bulkUpdateMessages,
  searchMessages,
  getMessagesForDoctor,
} from "../controller/messageController.js";
import { isDashboardAuthenticated } from "../middlewares/auth.js";
const router = express.Router();

/**
 * @openapi
 * /message/send:
 *   post:
 *     tags:
 *       - Message
 *     summary: Send a message
 *     description: Send a new message to the system or to a specific recipient
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
 *               - message
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
 *               phone:
 *                 type: string
 *               message:
 *                 type: string
 *                 minLength: 10
 *               recipient:
 *                 type: string
 *                 description: User ID of message recipient
 *     responses:
 *       201:
 *         description: Message sent successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Message'
 */
router.post("/send", sendMessage);

/**
 * @openapi
 * /message/getall:
 *   get:
 *     tags:
 *       - Message
 *     summary: Get all messages
 *     description: Retrieve all messages (Dashboard users only)
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of messages
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Message'
 *       403:
 *         description: Forbidden
 */
router.get("/getall", isDashboardAuthenticated, getAllMessages);

/**
 * @openapi
 * /message/search:
 *   get:
 *     tags:
 *       - Message
 *     summary: Search messages
 *     description: Search messages by criteria (Dashboard users only)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: q
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Matching messages
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Message'
 */
router.get("/search", isDashboardAuthenticated, searchMessages);

/**
 * @openapi
 * /message/{id}:
 *   put:
 *     tags:
 *       - Message
 *     summary: Update message
 *     description: Update an existing message (Dashboard users only)
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
 *               read:
 *                 type: boolean
 *               markedForDeletion:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Message updated
 *   delete:
 *     tags:
 *       - Message
 *     summary: Delete message
 *     description: Remove a message (Dashboard users only)
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
 *         description: Message deleted
 */
router.put("/:id", isDashboardAuthenticated, updateMessage);
router.delete("/:id", isDashboardAuthenticated, deleteMessageById);

/**
 * @openapi
 * /message/bulk-delete:
 *   post:
 *     tags:
 *       - Message
 *     summary: Bulk delete messages
 *     description: Delete multiple messages by IDs (Dashboard users only)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               ids:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Messages deleted
 */
router.post("/bulk-delete", isDashboardAuthenticated, bulkDeleteMessages);

/**
 * @openapi
 * /message/bulk-update:
 *   post:
 *     tags:
 *       - Message
 *     summary: Bulk update messages
 *     description: Update multiple messages at once (Dashboard users only)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               ids:
 *                 type: array
 *                 items:
 *                   type: string
 *               updates:
 *                 type: object
 *     responses:
 *       200:
 *         description: Messages updated
 */
router.post("/bulk-update", isDashboardAuthenticated, bulkUpdateMessages);

/**
 * @openapi
 * /message/doctor/{id}:
 *   get:
 *     tags:
 *       - Message
 *     summary: Get messages for doctor
 *     description: Retrieve messages sent to a specific doctor (Dashboard users only)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: Doctor ID
 *     responses:
 *       200:
 *         description: Doctor messages
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Message'
 */
// Get messages sent to a specific doctor

router.get('/doctor/:id', isDashboardAuthenticated, getMessagesForDoctor);

export default router;
