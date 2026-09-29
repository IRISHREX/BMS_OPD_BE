import mongoose from "mongoose";
import dns from "dns";
dns.setServers(["8.8.8.8", "1.1.1.1"]);

export const dbConnection = async () => {
  const localUri = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/throgendb";
  const dbName = process.env.DB_NAME || "throgendb";
  const atlasUri = process.env.MONGO_URI_ATLAS;

  const maxRetries = 30;
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

  // If explicitly enabled, try Atlas, otherwise exit with error so PM2 restarts when mongod is ready
  if (process.env.USE_ATLAS_FAILOVER === "true" && atlasUri) {
    console.log("🔄 Initiating automatic failover to MongoDB Atlas...");
    try {
      await mongoose.connect(atlasUri, {
        dbName: dbName,
        serverSelectionTimeoutMS: 10000,
      });
      console.log("✅ Connected to fallback MongoDB Atlas successfully!");
      return;
    } catch (atlasErr) {
      console.error("❌ Atlas failover also failed:", atlasErr.message);
    }
  }

  console.error("❌ Failed to connect to local MongoDB after 30 attempts. Exiting process so PM2 can retry.");
  process.exit(1);
};
