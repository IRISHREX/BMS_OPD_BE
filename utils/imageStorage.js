import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Image storage directory - relative to project root
const IMAGE_STORAGE_DIR = path.join(__dirname, '../public/images');

// Ensure image storage directory exists
export const ensureImageStorageDir = () => {
  if (!fs.existsSync(IMAGE_STORAGE_DIR)) {
    fs.mkdirSync(IMAGE_STORAGE_DIR, { recursive: true });
    console.log(`✅ Image storage directory created: ${IMAGE_STORAGE_DIR}`);
  }
};

// Delete image file from disk
export const deleteImageFile = (imagePath) => {
  if (!imagePath) return false;
  
  try {
    // If imagePath is just the filename, prepend the directory
    const fullPath = imagePath.startsWith('/') 
      ? path.join(IMAGE_STORAGE_DIR, path.basename(imagePath))
      : imagePath;
    
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
      console.log(`✅ Image file deleted: ${fullPath}`);
      return true;
    }
  } catch (err) {
    console.error(`❌ Error deleting image file: ${err.message}`);
  }
  return false;
};

// Get image directory path (for multer destination)
export const getImageStorageDir = () => {
  ensureImageStorageDir();
  return IMAGE_STORAGE_DIR;
};

// Generate image URL path from filename
export const generateImageUrl = (filename) => {
  if (!filename) return null;
  return `/images/${filename}`;
};

// Extract filename from image path/URL
export const getFilenameFromPath = (imagePath) => {
  if (!imagePath) return null;
  return path.basename(imagePath);
};

export default {
  IMAGE_STORAGE_DIR,
  ensureImageStorageDir,
  deleteImageFile,
  getImageStorageDir,
  generateImageUrl,
  getFilenameFromPath,
};
