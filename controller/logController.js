import { Log } from "../models/logSchema.js";
import { LogSettings } from "../models/logSettingsSchema.js";
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

  let settings = await LogSettings.findOne();
  if (!settings) {
    settings = await LogSettings.create({ maxLogsLimit: 500, autoDeleteEnabled: true });
  }

  const [totalLogs, todayTotal, todayErrors, todayWarns, recentErrors] = await Promise.all([
    Log.countDocuments(),
    Log.countDocuments({ createdAt: { $gte: startOfToday } }),
    Log.countDocuments({ level: "ERROR", createdAt: { $gte: startOfToday } }),
    Log.countDocuments({ level: "WARN", createdAt: { $gte: startOfToday } }),
    Log.find({ level: "ERROR" })
      .sort({ createdAt: -1 })
      .limit(5)
      .select("action message createdAt user.name")
      .lean(),
  ]);

  const maxLogsLimit = settings.maxLogsLimit || 500;
  const daysSinceLastDownload = settings.lastDownloadDate
    ? Math.floor((now.getTime() - new Date(settings.lastDownloadDate).getTime()) / (1000 * 60 * 60 * 24))
    : 999;

  // Alert prompt: if never downloaded or >= 7 days since last download and logs exist
  const shouldPromptDownload = totalLogs > 0 && (daysSinceLastDownload >= (settings.alertFrequencyDays || 7) || totalLogs >= maxLogsLimit * 0.85);

  res.status(200).json({
    success: true,
    stats: {
      totalLogs,
      maxLogsLimit,
      autoDeleteEnabled: settings.autoDeleteEnabled !== false,
      capacityPercent: Math.min(100, Number(((totalLogs / maxLogsLimit) * 100).toFixed(1))),
      todayTotal,
      todayErrors,
      todayWarns,
      systemHealth: todayErrors === 0 ? "HEALTHY" : todayErrors < 5 ? "WARNING" : "CRITICAL",
      recentErrors,
      lastDownloadDate: settings.lastDownloadDate,
      daysSinceLastDownload,
      shouldPromptDownload,
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

// 4. Get Log Settings
export const getLogSettings = catchAsyncErrors(async (req, res, next) => {
  let settings = await LogSettings.findOne();
  if (!settings) {
    settings = await LogSettings.create({ maxLogsLimit: 500, autoDeleteEnabled: true });
  }
  res.status(200).json({ success: true, settings });
});

// 5. Update Log Settings
export const updateLogSettings = catchAsyncErrors(async (req, res, next) => {
  const { maxLogsLimit, autoDeleteEnabled, alertFrequencyDays } = req.body;

  const update = {};
  if (maxLogsLimit !== undefined) {
    const val = Number(maxLogsLimit);
    if (isNaN(val) || val <= 0) {
      return next(new ErrorHandler("Max logs limit must be a positive number", 400));
    }
    update.maxLogsLimit = val;
  }

  if (autoDeleteEnabled !== undefined) {
    update.autoDeleteEnabled = Boolean(autoDeleteEnabled);
  }

  if (alertFrequencyDays !== undefined) {
    const val = Number(alertFrequencyDays);
    if (!isNaN(val) && val > 0) update.alertFrequencyDays = val;
  }

  const settings = await LogSettings.findOneAndUpdate({}, update, {
    new: true,
    upsert: true,
  });

  // Check if current log count exceeds new limit
  if (settings.autoDeleteEnabled !== false) {
    const count = await Log.countDocuments();
    if (count > settings.maxLogsLimit) {
      const excess = count - settings.maxLogsLimit;
      const oldest = await Log.find().sort({ createdAt: 1 }).limit(excess).select("_id");
      if (oldest.length > 0) {
        await Log.deleteMany({ _id: { $in: oldest.map((l) => l._id) } });
      }
    }
  }

  res.status(200).json({
    success: true,
    message: "Log settings updated successfully",
    settings,
  });
});

// 6. Mark Logs Downloaded (Record download timestamp)
export const markLogsDownloaded = catchAsyncErrors(async (req, res, next) => {
  const settings = await LogSettings.findOneAndUpdate(
    {},
    { lastDownloadDate: new Date() },
    { new: true, upsert: true }
  );

  res.status(200).json({
    success: true,
    message: "Logs download recorded",
    lastDownloadDate: settings.lastDownloadDate,
  });
});
