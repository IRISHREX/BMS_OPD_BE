import { catchAsyncErrors } from "../middlewares/catchAsyncErrors.js";
import ErrorHandler from "../middlewares/error.js";
import { GeneralSettings } from "../models/generalSettingsSchema.js";
import { User } from "../models/userSchema.js";
import { uploadDoctorAssetToS3 } from "../utils/s3Storage.js";
import fs from "fs";
import path from "path";

/**
 * Normalizes address for similarity comparison
 */
function normalizeAddr(str) {
  return (str || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Checks if two addresses are identical or similar (substring or >=55% token overlap)
 */
export function areAddressesSimilar(a, b) {
  const normA = normalizeAddr(a);
  const normB = normalizeAddr(b);
  if (!normA || !normB) return false;
  if (normA === normB) return true;
  if (normA.includes(normB) || normB.includes(normA)) return true;

  const wordsA = new Set(normA.split(" ").filter((w) => w.length > 2));
  const wordsB = new Set(normB.split(" ").filter((w) => w.length > 2));
  if (wordsA.size === 0 || wordsB.size === 0) return false;

  let intersection = 0;
  for (const w of wordsA) {
    if (wordsB.has(w)) intersection++;
  }
  const union = new Set([...wordsA, ...wordsB]).size;
  return intersection / union >= 0.55;
}

/**
 * Helper to update savedAddresses list with similarity replacement and recent promotion
 */
export function updateSavedAddressesList(savedAddresses, newAddress) {
  if (!newAddress || typeof newAddress !== "string") return savedAddresses || [];
  const trimmed = newAddress.trim();
  if (trimmed.length < 3) return savedAddresses || [];

  const list = [...(savedAddresses || [])];
  const matchIndex = list.findIndex((item) => areAddressesSimilar(item, trimmed));

  if (matchIndex !== -1) {
    // Replace similar existing with most recent version and move to top
    list.splice(matchIndex, 1);
  }
  list.unshift(trimmed);

  // Keep up to 50 addresses
  return list.slice(0, 50);
}

export const getGeneralSettings = catchAsyncErrors(async (req, res, next) => {
  let settings = await GeneralSettings.findOne();
  if (!settings) {
    settings = await GeneralSettings.create({});
  }
  res.status(200).json({
    success: true,
    settings,
  });
});

export const updateGeneralSettings = catchAsyncErrors(async (req, res, next) => {
  let settings = await GeneralSettings.findOne();
  if (!settings) {
    settings = new GeneralSettings({});
  }

  const {
    orgName,
    regNo,
    address,
    ownerName,
    platformFee,
    googleLocationUrl,
    removeHeaderImage,
    removeFooterImage,
    soundVolume,
    soundMuted,
    soundSettings,
    savedAddresses,
  } = req.body;

  if (orgName !== undefined) settings.orgName = orgName;
  if (regNo !== undefined) settings.regNo = regNo;
  if (ownerName !== undefined) settings.ownerName = ownerName;
  if (platformFee !== undefined) settings.platformFee = Number(platformFee) || 0;
  if (googleLocationUrl !== undefined) settings.googleLocationUrl = googleLocationUrl;

  // Handle address update & auto-save to savedAddresses with similarity
  if (address !== undefined && typeof address === "string") {
    settings.address = address.trim();
    if (settings.address) {
      settings.savedAddresses = updateSavedAddressesList(settings.savedAddresses, settings.address);
    }
  }

  // Handle explicit savedAddresses array if provided
  if (savedAddresses !== undefined) {
    if (Array.isArray(savedAddresses)) {
      settings.savedAddresses = savedAddresses.map((a) => (typeof a === "string" ? a.trim() : "")).filter(Boolean);
    } else if (typeof savedAddresses === "string") {
      try {
        const parsed = JSON.parse(savedAddresses);
        if (Array.isArray(parsed)) {
          settings.savedAddresses = parsed.map((a) => (typeof a === "string" ? a.trim() : "")).filter(Boolean);
        }
      } catch (_) {}
    }
  }

  // Handle sound settings (volume & muted)
  if (soundSettings) {
    try {
      const parsed = typeof soundSettings === "string" ? JSON.parse(soundSettings) : soundSettings;
      if (parsed.volume !== undefined) {
        settings.soundSettings.volume = Math.max(0, Math.min(100, Number(parsed.volume)));
      }
      if (parsed.isMuted !== undefined) {
        settings.soundSettings.isMuted = Boolean(parsed.isMuted);
      }
    } catch (_) {}
  }
  if (soundVolume !== undefined) {
    settings.soundSettings = settings.soundSettings || {};
    settings.soundSettings.volume = Math.max(0, Math.min(100, Number(soundVolume)));
  }
  if (soundMuted !== undefined) {
    settings.soundSettings = settings.soundSettings || {};
    settings.soundSettings.isMuted = soundMuted === "true" || soundMuted === true;
  }

  // Handle commission settings (predefined commissions based on booking type)
  const incomingComm = req.body.commissionSettings;
  if (incomingComm) {
    try {
      const parsed = typeof incomingComm === "string" ? JSON.parse(incomingComm) : incomingComm;
      settings.commissionSettings = settings.commissionSettings || {};
      if (parsed.registeredSelfPercentage !== undefined) {
        settings.commissionSettings.registeredSelfPercentage = Math.max(0, Math.min(100, Number(parsed.registeredSelfPercentage)));
      }
      if (parsed.registeredOtherPercentage !== undefined) {
        settings.commissionSettings.registeredOtherPercentage = Math.max(0, Math.min(100, Number(parsed.registeredOtherPercentage)));
      }
      if (parsed.guestSelfPercentage !== undefined) {
        settings.commissionSettings.guestSelfPercentage = Math.max(0, Math.min(100, Number(parsed.guestSelfPercentage)));
      }
      if (parsed.guestOtherPercentage !== undefined) {
        settings.commissionSettings.guestOtherPercentage = Math.max(0, Math.min(100, Number(parsed.guestOtherPercentage)));
      }
      if (parsed.defaultPercentage !== undefined) {
        settings.commissionSettings.defaultPercentage = Math.max(0, Math.min(100, Number(parsed.defaultPercentage)));
      }
    } catch (_) {}
  }

  // Also persist sound settings to currently authenticated user if present
  if (req.user && (soundVolume !== undefined || soundMuted !== undefined || soundSettings)) {
    try {
      const user = await User.findById(req.user._id);
      if (user) {
        user.soundSettings = user.soundSettings || {};
        if (settings.soundSettings.volume !== undefined) user.soundSettings.volume = settings.soundSettings.volume;
        if (settings.soundSettings.isMuted !== undefined) user.soundSettings.isMuted = settings.soundSettings.isMuted;
        await user.save();
      }
    } catch (uErr) {
      console.warn("Could not save sound settings to user:", uErr.message);
    }
  }

  // Handle file removals
  if (removeHeaderImage === "true") {
    settings.defaultHeaderImage = "/Header.jpeg";
  }
  if (removeFooterImage === "true") {
    settings.defaultFooterImage = "/Footer.png";
  }

  // Handle uploaded files
  if (req.files) {
    if (req.files.defaultHeaderImage && req.files.defaultHeaderImage[0]) {
      const f = req.files.defaultHeaderImage[0];
      const filePath = `/uploads/doctors/${f.filename}`;
      settings.defaultHeaderImage = filePath;

      // Sync to S3
      const fullDiskPath = path.join(process.cwd(), "uploads", "doctors", f.filename);
      fs.readFile(fullDiskPath, (err, buffer) => {
        if (!err && buffer) {
          uploadDoctorAssetToS3(f.filename, buffer, f.mimetype).catch((s3Err) =>
            console.warn("Failed to sync defaultHeaderImage to S3:", s3Err.message)
          );
        }
      });
    }

    if (req.files.defaultFooterImage && req.files.defaultFooterImage[0]) {
      const f = req.files.defaultFooterImage[0];
      const filePath = `/uploads/doctors/${f.filename}`;
      settings.defaultFooterImage = filePath;

      // Sync to S3
      const fullDiskPath = path.join(process.cwd(), "uploads", "doctors", f.filename);
      fs.readFile(fullDiskPath, (err, buffer) => {
        if (!err && buffer) {
          uploadDoctorAssetToS3(f.filename, buffer, f.mimetype).catch((s3Err) =>
            console.warn("Failed to sync defaultFooterImage to S3:", s3Err.message)
          );
        }
      });
    }
  }

  await settings.save();

  res.status(200).json({
    success: true,
    message: "General settings updated successfully!",
    settings,
  });
});

/**
 * Add or promote an address into storage
 */
export const saveAddressToStorage = catchAsyncErrors(async (req, res, next) => {
  const { address } = req.body;
  if (!address || typeof address !== "string" || !address.trim()) {
    return next(new ErrorHandler("Address string is required", 400));
  }

  let settings = await GeneralSettings.findOne();
  if (!settings) {
    settings = new GeneralSettings({});
  }

  settings.savedAddresses = updateSavedAddressesList(settings.savedAddresses, address);
  await settings.save();

  res.status(200).json({
    success: true,
    message: "Address saved to storage successfully",
    savedAddresses: settings.savedAddresses,
  });
});

/**
 * Remove an address from storage
 */
export const deleteAddressFromStorage = catchAsyncErrors(async (req, res, next) => {
  const { address } = req.body;
  if (!address || typeof address !== "string") {
    return next(new ErrorHandler("Address string is required", 400));
  }

  let settings = await GeneralSettings.findOne();
  if (!settings) {
    return res.status(200).json({ success: true, savedAddresses: [] });
  }

  const target = address.trim().toLowerCase();
  settings.savedAddresses = (settings.savedAddresses || []).filter(
    (a) => a.trim().toLowerCase() !== target
  );
  await settings.save();

  res.status(200).json({
    success: true,
    message: "Address removed from storage",
    savedAddresses: settings.savedAddresses,
  });
});

/**
 * Save user sound preferences (volume and muted status)
 */
export const updateSoundSettings = catchAsyncErrors(async (req, res, next) => {
  const { volume, isMuted } = req.body;

  let settings = await GeneralSettings.findOne();
  if (!settings) settings = new GeneralSettings({});

  settings.soundSettings = settings.soundSettings || {};
  if (volume !== undefined) {
    settings.soundSettings.volume = Math.max(0, Math.min(100, Number(volume)));
  }
  if (isMuted !== undefined) {
    settings.soundSettings.isMuted = Boolean(isMuted);
  }
  await settings.save();

  if (req.user) {
    try {
      const user = await User.findById(req.user._id);
      if (user) {
        user.soundSettings = user.soundSettings || {};
        if (volume !== undefined) user.soundSettings.volume = Math.max(0, Math.min(100, Number(volume)));
        if (isMuted !== undefined) user.soundSettings.isMuted = Boolean(isMuted);
        await user.save();
      }
    } catch (_) {}
  }

  res.status(200).json({
    success: true,
    message: "Sound settings saved successfully!",
    soundSettings: settings.soundSettings,
  });
});

/**
 * Save predefined referral commission settings based on user type & booking target
 */
export const updateCommissionSettings = catchAsyncErrors(async (req, res, next) => {
  const {
    registeredSelfPercentage,
    registeredOtherPercentage,
    guestSelfPercentage,
    guestOtherPercentage,
    defaultPercentage,
  } = req.body;

  let settings = await GeneralSettings.findOne();
  if (!settings) settings = new GeneralSettings({});

  settings.commissionSettings = settings.commissionSettings || {};
  if (registeredSelfPercentage !== undefined) {
    settings.commissionSettings.registeredSelfPercentage = Math.max(0, Math.min(100, Number(registeredSelfPercentage)));
  }
  if (registeredOtherPercentage !== undefined) {
    settings.commissionSettings.registeredOtherPercentage = Math.max(0, Math.min(100, Number(registeredOtherPercentage)));
  }
  if (guestSelfPercentage !== undefined) {
    settings.commissionSettings.guestSelfPercentage = Math.max(0, Math.min(100, Number(guestSelfPercentage)));
  }
  if (guestOtherPercentage !== undefined) {
    settings.commissionSettings.guestOtherPercentage = Math.max(0, Math.min(100, Number(guestOtherPercentage)));
  }
  if (defaultPercentage !== undefined) {
    settings.commissionSettings.defaultPercentage = Math.max(0, Math.min(100, Number(defaultPercentage)));
  }

  await settings.save();

  res.status(200).json({
    success: true,
    message: "Referral commission settings updated successfully!",
    commissionSettings: settings.commissionSettings,
  });
});

