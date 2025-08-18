import express from "express";
import mongoose, { Schema, Document } from "mongoose";
import bcrypt from "bcryptjs";
import cors from "cors";
import bodyParser from "body-parser";
import jwt from "jsonwebtoken";
import cookieParser from "cookie-parser";

import type { Request, Response, NextFunction } from "express";

const app = express();
const PORT = process.env.PORT || 5000;

// ================== Middleware ==================
app.use(
  cors({
    origin: [
      "http://localhost:5173",           // local dev
      "https://manish-task.vercel.app",  // deployed frontend
    ],
    methods: ["GET", "POST"],
    credentials: true,
  })
);

app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ================== MongoDB Connection ==================
mongoose
  .connect(
    "mongodb+srv://admin:admin123@cluster0expmanish.izoem.mongodb.net/User?retryWrites=true&w=majority&appName=Cluster0ExpManish"
  )
  .then(() => console.log("✅ MongoDB Connected"))
  .catch((err) => console.error("DB Error:", err));

// ================== User Model ==================
interface IUser extends Document {
  name: string;
  email: string;
  password: string;
}

const UserSchema: Schema<IUser> = new Schema<IUser>({
  name: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
});

const User = mongoose.model<IUser>("User", UserSchema);

// ================== Validation Helpers ==================
const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

// ... keep your validation functions here ...

// ================== Routes ==================

// Health check
app.get("/health", (req: Request, res: Response) => {
  res.json({
    status: "Server is running ✅",
    timestamp: new Date().toISOString(),
  });
});

// Register route
app.post("/register", async (req: Request, res: Response) => {
  // ... your register logic ...
});

// Login route
app.post("/login", async (req: Request, res: Response) => {
  // ... your login logic ...
});

// Logout route
app.post("/logout", (req: Request, res: Response) => {
  res.clearCookie("token");
  res.json({ message: "👋 Logged out successfully" });
});

// User details
app.post("/me", async (req: Request, res: Response) => {
  // ... your /me logic ...
});

// ================== Error Handling ==================
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ error: "Internal server error" });
});

// Handle 404
app.use((req: Request, res: Response) => {
  res.status(404).json({ error: "Route not found" });
});

// ================== Start Server ==================
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
