import multer from 'multer';
import fs from 'fs';
import path from 'path';

// Ensure uploads directory exists
const uploadsDir = path.join(process.cwd(), 'uploads', 'doctors');
fs.mkdirSync(uploadsDir, { recursive: true });

// Multer disk storage (kept for backwards compat) and memory storage for DB upload
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    const safeName = file.originalname.replace(/\s+/g, '_');
    cb(null, `${Date.now()}_${safeName}`);
  },
});
const memoryStorage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  const allowed = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
  if (allowed.includes(file.mimetype)) cb(null, true);
  else cb(null, false);
};

const uploadDisk = multer({ storage, fileFilter, limits: { fileSize: 5 * 1024 * 1024 } }); // 5MB limit
const uploadMemory = multer({ storage: memoryStorage, fileFilter, limits: { fileSize: 5 * 1024 * 1024 } });

// fields: docAvatar (required in UI), signImage (optional), headerImage (optional)
export const uploadDoctorImagesDisk = uploadDisk.fields([
  { name: 'docAvatar', maxCount: 1 },
  { name: 'signImage', maxCount: 1 },
  { name: 'headerImage', maxCount: 1 },
]);

export const uploadDoctorImagesMemory = uploadMemory.fields([
  { name: 'docAvatar', maxCount: 1 },
  { name: 'signImage', maxCount: 1 },
  { name: 'headerImage', maxCount: 1 },
]);

export default uploadDisk;
