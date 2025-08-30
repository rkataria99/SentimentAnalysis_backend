import mongoose from "mongoose";

export async function connectDB(uri) {
  if (!uri) {
    console.error("MONGO_URI missing");
    process.exit(1);
  }
  try {
    await mongoose.connect(uri, { });
    console.log("✅ MongoDB connected");
  } catch (err) {
    console.error("Mongo connection error", err);
    process.exit(1);
  }
}
