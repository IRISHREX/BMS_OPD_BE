import { Log } from "../models/logSchema.js";
import { catchAsyncErrors } from "../middlewares/catchAsyncErrors.js";
import ErrorHandler from "../middlewares/error.js";

// 1. Get Paginated & Filtered Logs
export const getLogs = catchAsyncErrors(async (req, res, next) => {
  const {
    page = 1,
    limit = 25,
    level,
    category,
    search,
    from,
    to,
  } = req.query;

  const query = {};

  // Level filter
  if (level && level.toUpperCase() !== "ALL") {
    query.level = level.toUpperCase();
  }

  // Category filter
  if (category && category.toUpperCase() !== "ALL") {
    query.category = category;
  }

  // Search filter (searches message, action, user name, ip)
  if (search && search.trim()) {
    const searchRegex = new RegExp(search.trim(), "i");
    query.$or = [
      { message: searchRegex },
      { action: searchRegex },
      { "user.name": searchRegex },
      { ip: searchRegex },
      { url: searchRegex },
    ];
  }

  // Date range filter
  if (from || to) {
    query.createdAt = {};
    if (from && !isNaN(new Date(from).getTime())) {
      query.createdAt.$gte = new Date(from);
    }
    if (to && !isNaN(new Date(to).getTime())) {
      const toDate = new Date(to);
      toDate.setHours(23, 59, 59, 999);
      query.createdAt.$lte = toDate;
    }
    if (Object.keys(query.createdAt).length === 0) {
      delete query.createdAt;
    }
  }

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 25));
  const skip = (pageNum - 1) * limitNum;

  // Run queries in parallel
  const [logs, total, totalAll, totalError, totalWarn, totalInfo, totalSuccess] =
    await Promise.all([
      Log.find(query).sort({ createdAt: -1 }).skip(skip).limit(limitNum).lean(),
      Log.countDocuments(query),
      Log.countDocuments(),
      Log.countDocuments({ level: "ERROR" }),
      Log.countDocuments({ level: "WARN" }),
      Log.countDocuments({ level: "INFO" }),
      Log.countDocuments({ level: "SUCCESS" }),
    ]);

  res.status(200).json({
    success: true,
    logs,
    pagination: {
      page: pageNum,
      limit: limitNum,
      total,
      totalPages: Math.ceil(total / limitNum) || 1,
    },
    counts: {
      all: totalAll,
      error: totalError,
      warn: totalWarn,
      info: totalInfo,
      success: totalSuccess,
    },
  });
});

// 2. Get Log Statistics for Dashboard / Health Indicator
export const getLogStats = catchAsyncErrors(async (req, res, next) => {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const [todayTotal, todayErrors, todayWarns, recentErrors] = await Promise.all([
    Log.countDocuments({ createdAt: { $gte: startOfToday } }),
    Log.countDocuments({ level: "ERROR", createdAt: { $gte: startOfToday } }),
    Log.countDocuments({ level: "WARN", createdAt: { $gte: startOfToday } }),
    Log.find({ level: "ERROR" })
      .sort({ createdAt: -1 })
      .limit(5)
      .select("action message createdAt user.name")
      .lean(),
  ]);

  res.status(200).json({
    success: true,
    stats: {
      todayTotal,
      todayErrors,
      todayWarns,
      systemHealth: todayErrors === 0 ? "HEALTHY" : todayErrors < 5 ? "WARNING" : "CRITICAL",
      recentErrors,
    },
  });
});

// 3. Clear Logs (Purge all or older than X days)
export const clearLogs = catchAsyncErrors(async (req, res, next) => {
  const { olderThanDays } = req.body;

  let query = {};
  if (olderThanDays) {
    const days = parseInt(olderThanDays, 10);
    if (!isNaN(days) && days > 0) {
      const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
      query = { createdAt: { $lt: cutoff } };
    }
  }

  const result = await Log.deleteMany(query);

  res.status(200).json({
    success: true,
    message: `Successfully deleted ${result.deletedCount} log entries.`,
    deletedCount: result.deletedCount,
  });
});
