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

router.post("/send", sendMessage);
router.get("/getall", isDashboardAuthenticated, getAllMessages);
router.get("/search", isDashboardAuthenticated, searchMessages);
router.put("/:id", isDashboardAuthenticated, updateMessage);
router.delete("/:id", isDashboardAuthenticated, deleteMessageById);
router.post("/bulk-delete", isDashboardAuthenticated, bulkDeleteMessages);
router.post("/bulk-update", isDashboardAuthenticated, bulkUpdateMessages);
// Get messages sent to a specific doctor

router.get('/doctor/:id', isDashboardAuthenticated, getMessagesForDoctor);

export default router;
