
import mongoose from "mongoose";

let isConnected = false;

async function connectDB() {
  if (isConnected) return;

  try {
    // Check if we have a connection to the database or if it's currently connecting or disconnecting
    if (mongoose.connection.readyState >= 1) {
      isConnected = true;
      return;
    }

    await mongoose.connect(process.env.MONGO_URI, {
      dbName: "blogapp",
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });

    isConnected = true;
    console.log("MongoDB Connected");
  } catch (err) {
    console.error("MongoDB connection error:", err);
  }
}

export default connectDB;
