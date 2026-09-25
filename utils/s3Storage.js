import { S3Client, PutObjectCommand, GetObjectCommand, ListObjectsV2Command, DeleteObjectCommand, GetObjectCommand as GetObjectCommandForUrl } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import fs from "fs";
import path from "path";

const s3Endpoint = process.env.S3_ENDPOINT || "https://s3.aiccloud.online";
const s3Region = process.env.S3_REGION || "us-east-1";
const s3Bucket = process.env.S3_BUCKET || "aic-585105c0";
const s3AccessKey = process.env.S3_ACCESS_KEY || "4987216CA9E680068A03";
const s3SecretKey = process.env.S3_SECRET_KEY || "iFoDGF0LaDaGqkg7FoJB7z4sUf8";

export const s3Client = new S3Client({
  region: s3Region,
  endpoint: s3Endpoint,
  credentials: {
    accessKeyId: s3AccessKey,
    secretAccessKey: s3SecretKey,
  },
  forcePathStyle: true,
});

/**
 * Upload a buffer, stream, or string directly to S3
 */
export const uploadToS3 = async (key, body, contentType = "application/octet-stream") => {
  const command = new PutObjectCommand({
    Bucket: s3Bucket,
    Key: key,
    Body: body,
    ContentType: contentType,
  });
  return await s3Client.send(command);
};

/**
 * Upload a doctor image asset (stamp, avatar, header, footer, sign) to S3
 */
export const uploadDoctorAssetToS3 = async (filename, fileBuffer, contentType = "image/jpeg") => {
  const key = `doctors/${filename}`;
  return await uploadToS3(key, fileBuffer, contentType);
};

/**
 * Fetch an object directly from S3 as a stream
 */
export const getS3Object = async (key) => {
  try {
    const command = new GetObjectCommand({
      Bucket: s3Bucket,
      Key: key,
    });
    return await s3Client.send(command);
  } catch (err) {
    return null;
  }
};

/**
 * Upload a CSV backup to S3 under backups/csv/
 */
export const uploadCsvBackupToS3 = async (fileName, csvContent) => {
  const key = `backups/csv/${fileName}`;
  return await uploadToS3(key, csvContent, "text/csv");
};

/**
 * List files in S3
 */
export const listS3Backups = async (prefix = "backups/") => {
  const command = new ListObjectsV2Command({
    Bucket: s3Bucket,
    Prefix: prefix,
  });
  const res = await s3Client.send(command);
  return (res.Contents || []).map(item => ({
    key: item.Key,
    size: item.Size,
    lastModified: item.LastModified,
  }));
};

/**
 * Sync entire local uploads directory to S3
 */
export const syncUploadsToS3 = async (uploadsDir) => {
  if (!fs.existsSync(uploadsDir)) return { uploaded: 0 };
  const files = fs.readdirSync(uploadsDir);
  let count = 0;
  for (const file of files) {
    const filePath = path.join(uploadsDir, file);
    if (fs.statSync(filePath).isFile()) {
      const ext = path.extname(file).toLowerCase();
      let mime = "application/octet-stream";
      if (ext === ".jpg" || ext === ".jpeg") mime = "image/jpeg";
      else if (ext === ".png") mime = "image/png";
      else if (ext === ".webp") mime = "image/webp";
      const buffer = fs.readFileSync(filePath);
      await uploadDoctorAssetToS3(file, buffer, mime);
      count++;
    }
  }
  return { uploaded: count };
};

/**
 * Upload a prescription PDF buffer to S3
 * Key pattern: prescriptions/{patientId}/{date}_{prescriptionId}.pdf
 */
export const uploadPrescriptionPdfToS3 = async (patientId, prescriptionId, dateStr, pdfBuffer) => {
  const key = `prescriptions/${patientId}/${dateStr}_${prescriptionId}.pdf`;
  await uploadToS3(key, pdfBuffer, "application/pdf");
  return key;
};

/**
 * Delete a single S3 object by key
 */
export const deleteS3Object = async (key) => {
  try {
    const command = new DeleteObjectCommand({ Bucket: s3Bucket, Key: key });
    await s3Client.send(command);
    return true;
  } catch (err) {
    console.warn("S3 delete failed for key:", key, err.message);
    return false;
  }
};

/**
 * Generate a pre-signed download URL for an S3 object (valid 3600s = 1h)
 */
export const getPresignedDownloadUrl = async (key, expiresIn = 3600) => {
  try {
    const command = new GetObjectCommand({ Bucket: s3Bucket, Key: key });
    return await getSignedUrl(s3Client, command, { expiresIn });
  } catch (err) {
    console.warn("Presign failed for key:", key, err.message);
    return null;
  }
};
