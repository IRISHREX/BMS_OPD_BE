import express from "express";
import { dbConnection } from "./database/dbConnection.js";
import { config } from "dotenv";
import cookieParser from "cookie-parser";
import cors from "cors";
import fileUpload from "express-fileupload";
import { errorMiddleware } from "./middlewares/error.js";
import messageRouter from "./router/messageRouter.js";
import userRouter from "./router/userRouter.js";
import appointmentRouter from "./router/appointmentRouter.js";
import medicalAdviceRouter from "./router/medicalAdviceRouter.js";
import invoiceRouter from "./router/invoiceRouter.js";

const app = express();
config({ path: "./.env" });

// Build an explicit whitelist for CORS. Do NOT use '*' when credentials: true.
// Add common local dev origins so the dashboard and frontend can talk to the API
// without extra env configuration during development.
const frontendOrigins = [
  process.env.FRONTEND_URL_ONE,
  process.env.FRONTEND_URL_TWO,
  process.env.FRONTEND_URL_PROD,
  process.env.FRONTEND_URL_PROD_TWO,
].filter(Boolean);
app.use(
  cors({
    origin: function (origin, callback) {
      // Allow requests with no origin (like mobile apps, curl, server-to-server)
      if (!origin) return callback(null, true);
      if (frontendOrigins.indexOf(origin) !== -1) return callback(null, true);
      // Log blocked origin for easier debugging
      console.warn('CORS blocked origin:', origin);
      return callback(new Error('CORS policy: This origin is not allowed - ' + origin));
    },
    methods: ["GET", "POST", "DELETE", "PUT", "OPTIONS"],
    credentials: true,
  })
);

app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(
  fileUpload({
    useTempFiles: true,
    tempFileDir: "/tmp/",
  })
);
app.use("/api/v1/message", messageRouter);
app.use("/api/v1/user", userRouter);
app.use("/api/v1/appointment", appointmentRouter);
app.use("/api/v1/medical", medicalAdviceRouter);
app.use("/api/v1/invoice", invoiceRouter);

// Debug endpoint to inspect request cookies, headers and authenticated user.
// This is intentionally only enabled when not in production to avoid exposing internals.
app.get('/debug/auth', (req, res) => {
  if (process.env.NODE_ENV === 'production') return res.status(404).json({ success: false });
  return res.status(200).json({
    success: true,
    headers: req.headers,
    cookies: req.cookies || {},
    user: req.user || null,
  });
});

dbConnection();

app.use(errorMiddleware);
export default app;
