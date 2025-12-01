// In-memory image cache for storing uploaded images temporarily
const imageCache = new Map();

// Generate a unique ID for the image and store the buffer
export const cacheImage = (buffer, mimetype, filename) => {
  const imageId = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  imageCache.set(imageId, {
    buffer,
    mimetype,
    filename,
    createdAt: Date.now(),
  });
  return imageId;
};

// Retrieve image from cache
export const getImageFromCache = (imageId) => {
  return imageCache.get(imageId);
};

// Delete image from cache
export const deleteImageFromCache = (imageId) => {
  return imageCache.delete(imageId);
};

// Clear old images (older than 24 hours) to prevent memory bloat
export const cleanupOldImages = () => {
  const now = Date.now();
  const oneDayMs = 24 * 60 * 60 * 1000;
  
  for (const [imageId, data] of imageCache.entries()) {
    if (now - data.createdAt > oneDayMs) {
      imageCache.delete(imageId);
    }
  }
};

// Run cleanup every hour
setInterval(cleanupOldImages, 60 * 60 * 1000);

export default imageCache;
