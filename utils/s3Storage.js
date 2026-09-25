import { S3Client, PutObjectCommand, GetObjectCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";

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
 * Upload a buffer or string directly to S3
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
 * Upload a CSV backup to S3 under backups/csv/
 */
export const uploadCsvBackupToS3 = async (fileName, csvContent) => {
  const key = `backups/csv/${fileName}`;
  return await uploadToS3(key, csvContent, "text/csv");
};

/**
 * List backups in S3
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
