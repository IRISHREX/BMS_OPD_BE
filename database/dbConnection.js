import mongoose from "mongoose";
import dns from "dns";
dns.setServers(["8.8.8.8", "1.1.1.1"]);

export const dbConnection = async () => {
  const localUri = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/MERN_STACK_HOSPITAL_MANAGEMENT";
  const atlasUri = process.env.MONGO_URI_ATLAS;

  try {
    // 1. Try local VPS MongoDB (fastest, <1ms latency)
    await mongoose.connect(localUri, {
      dbName: "MERN_STACK_HOSPITAL_MANAGEMENT",
      serverSelectionTimeoutMS: 3000,
    });
    console.log("✅ Connected to local MongoDB on VPS (127.0.0.1:27017)!");
  } catch (localErr) {
    console.warn("⚠️ Local MongoDB connection failed:", localErr.message);
    if (atlasUri) {
      console.log("🔄 Initiating automatic failover to MongoDB Atlas...");
      try {
        await mongoose.connect(atlasUri, {
          dbName: "MERN_STACK_HOSPITAL_MANAGEMENT",
          serverSelectionTimeoutMS: 10000,
        });
        console.log("✅ Connected to fallback MongoDB Atlas successfully!");
      } catch (atlasErr) {
        console.error("❌ Both local MongoDB and Atlas failover failed:", atlasErr.message);
      }
    }
  }
};
