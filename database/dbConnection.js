import mongoose from "mongoose";
import dns from "dns";
dns.setServers(["8.8.8.8", "1.1.1.1"]);

export const dbConnection = async () => {
  const localUri = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/throgendb";
  const dbName = process.env.DB_NAME || "throgendb";
  const atlasUri = process.env.MONGO_URI_ATLAS;

  const maxRetries = 8;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await mongoose.connect(localUri, {
        dbName: dbName,
        serverSelectionTimeoutMS: 3000,
      });
      console.log(`✅ Connected to local MongoDB on VPS (127.0.0.1:27017/${dbName}) on attempt ${attempt}!`);
      return;
    } catch (localErr) {
      console.warn(`⚠️ Local MongoDB attempt ${attempt}/${maxRetries} failed: ${localErr.message}`);
      if (attempt < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    }
  }

  if (atlasUri) {
    console.log("🔄 Initiating automatic failover to MongoDB Atlas...");
    try {
      await mongoose.connect(atlasUri, {
        dbName: dbName,
        serverSelectionTimeoutMS: 10000,
      });
      console.log("✅ Connected to fallback MongoDB Atlas successfully!");
    } catch (atlasErr) {
      console.error("❌ Both local MongoDB and Atlas failover failed:", atlasErr.message);
    }
  }
};
