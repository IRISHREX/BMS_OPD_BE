import express from "express";
import {
  getAllMessages,
  sendMessage,
  updateMessage,
  deleteMessageById,
  bulkDeleteMessages,
  searchMessages,
  getMessagesForDoctor,
} from "../controller/messageController.js";
import { isAdminAuthenticated } from "../middlewares/auth.js";
const router = express.Router();

router.post("/send", sendMessage);
router.get("/getall", getAllMessages);
router.get("/search", searchMessages);
router.put("/:id", updateMessage);
router.delete("/:id", deleteMessageById);
router.post("/bulk-delete", bulkDeleteMessages);
// Get messages sent to a specific doctor

router.get('/doctor/:id', getMessagesForDoctor);

export default router;
