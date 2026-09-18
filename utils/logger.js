import { Log } from "../models/logSchema.js";

/**
 * Non-blocking system logger utility
 */
export const logEvent = async ({
  level = "INFO",
  category = "System",
  action,
  message,
  req,
  user,
  metadata = {},
  statusCode,
}) => {
  try {
    let resolvedUser = {
      name: "System",
      role: "System",
    };

    if (user) {
      resolvedUser = {
        id: user._id,
        name: user.name || `${user.firstName || ""} ${user.lastName || ""}`.trim() || user.email || "User",
        role: user.role || "User",
        email: user.email,
      };
    } else if (req?.user) {
      resolvedUser = {
        id: req.user._id,
        name: req.user.name || `${req.user.firstName || ""} ${req.user.lastName || ""}`.trim() || req.user.email || "User",
        role: req.user.role || "User",
        email: req.user.email,
      };
    }

    const ip =
      req?.headers?.["x-forwarded-for"]?.split(",")?.[0]?.trim() ||
      req?.socket?.remoteAddress ||
      req?.ip ||
      "-";

    const method = req?.method || "-";
    const url = req?.originalUrl || req?.url || "-";
    const resolvedStatus = statusCode || (req?.res?.statusCode) || 200;

    await Log.create({
      level,
      category,
      action: action || "SYSTEM_EVENT",
      message: message || "Event recorded",
      user: resolvedUser,
      ip,
      method,
      url,
      statusCode: resolvedStatus,
      metadata,
    });
  } catch (err) {
    // Fail-safe: logging error should never interrupt the main thread
    console.error("[Logger] Failed to write log:", err.message);
  }
};
