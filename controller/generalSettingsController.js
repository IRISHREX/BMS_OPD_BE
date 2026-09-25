import { catchAsyncErrors } from "../middlewares/catchAsyncErrors.js";
import ErrorHandler from "../middlewares/error.js";
import { GeneralSettings } from "../models/generalSettingsSchema.js";
import { uploadDoctorAssetToS3 } from "../utils/s3Storage.js";
import fs from "fs";
import path from "path";

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
  } = req.body;

  if (orgName !== undefined) settings.orgName = orgName;
  if (regNo !== undefined) settings.regNo = regNo;
  if (address !== undefined) settings.address = address;
  if (ownerName !== undefined) settings.ownerName = ownerName;
  if (platformFee !== undefined) settings.platformFee = Number(platformFee) || 0;
  if (googleLocationUrl !== undefined) settings.googleLocationUrl = googleLocationUrl;

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
