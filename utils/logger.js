import { Log } from "../models/logSchema.js";
import { LogSettings } from "../models/logSettingsSchema.js";

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

    // Asynchronous auto-prune to ensure logs don't exceed max limit (default: 500)
    setImmediate(async () => {
      try {
        let settings = await LogSettings.findOne();
        if (!settings) {
          settings = await LogSettings.create({ maxLogsLimit: 500, autoDeleteEnabled: true });
        }

        if (settings.autoDeleteEnabled !== false) {
          const limit = settings.maxLogsLimit || 500;
          const count = await Log.countDocuments();
          if (count > limit) {
            const excess = count - limit;
            const oldestLogs = await Log.find()
              .sort({ createdAt: 1 })
              .limit(excess)
              .select("_id");
            if (oldestLogs.length > 0) {
              await Log.deleteMany({ _id: { $in: oldestLogs.map((l) => l._id) } });
            }
          }
        }
      } catch (pruneErr) {
        console.error("[Logger] Auto-prune failed:", pruneErr.message);
      }
    });
  } catch (err) {
    // Fail-safe: logging error should never interrupt the main thread
    console.error("[Logger] Failed to write log:", err.message);
  }
};
