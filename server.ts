
import express, { Request, Response, NextFunction } from "express";
import mongoose, { Schema, Document } from "mongoose";
import bcrypt from "bcryptjs";
import cors from "cors";
import bodyParser from "body-parser";
import jwt from "jsonwebtoken";
import cookieParser from "cookie-parser";

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || "secret_key";

// ================== Middleware ==================
app.use(
  cors({
    origin: [
      "http://localhost:5173",          // local dev
      "https://manish-task.vercel.app", // deployed frontend
    ],
    methods: ["GET", "POST"],
    credentials: true, // allow cookies
  })
);

app.use(bodyParser.json());
app.use(cookieParser());

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

// ================== Validation ==================
const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

// Register input validation
const validateRegisterInput = (name: string, email: string, password: string) => {
  const errors: { name?: string; email?: string; password?: string } = {};

  if (!name?.trim()) errors.name = "Name is required";
  else if (name.trim().length < 2) errors.name = "Name must be at least 2 characters long";
  else if (name.trim().length > 50) errors.name = "Name must be less than 50 characters";

  if (!email?.trim()) errors.email = "Email is required";
  else if (!emailRegex.test(email.trim())) errors.email = "Invalid email";

  if (!password) errors.password = "Password is required";
  else if (password.length < 6) errors.password = "Password must be at least 6 characters long";

  return { isValid: Object.keys(errors).length === 0, errors };
};

// Login input validation
const validateLoginInput = (email: string, password: string) => {
  const errors: { email?: string; password?: string } = {};
  if (!email?.trim()) errors.email = "Email is required";
  else if (!emailRegex.test(email.trim())) errors.email = "Invalid email";
  if (!password) errors.password = "Password is required";
  return { isValid: Object.keys(errors).length === 0, errors };
};

// ================== Routes ==================

// Health check
app.get("/health", (req: Request, res: Response) => {
  res.json({ status: "Server is running 🚀", timestamp: new Date().toISOString() });
});

// Register
app.post("/register", async (req: Request, res: Response) => {
  const { name, email, password } = req.body;
  const validation = validateRegisterInput(name, email, password);

  if (!validation.isValid) {
    return res.status(400).json({ error: "Validation failed", details: validation.errors });
  }

  try {
    const trimmedEmail = email.trim().toLowerCase();
    if (await User.findOne({ email: trimmedEmail })) {
      return res.status(400).json({ error: "Email already in use" });
    }
    if (await User.findOne({ name: name.trim() })) {
      return res.status(400).json({ error: "Username already taken" });
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const user = new User({ name: name.trim(), email: trimmedEmail, password: hashedPassword });
    await user.save();

    res.status(201).json({ message: "User registered successfully", user: { name: user.name, email: user.email } });
  } catch (err) {
    console.error("Register error:", err);
    res.status(500).json({ error: "Something went wrong while registering" });
  }
});

// Login
app.post("/login", async (req: Request, res: Response) => {
  const { email, password } = req.body;
  const validation = validateLoginInput(email, password);

  if (!validation.isValid) {
    return res.status(400).json({ error: "Validation failed", details: validation.errors });
  }

  try {
    const user = await User.findOne({ email: email.trim().toLowerCase() });
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(400).json({ error: "Invalid email or password" });
    }

    const token = jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: "1h" });
    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
    });

    res.json({ message: "Login successful 🎉", user: { name: user.name, email: user.email } });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Something went wrong while logging in" });
  }
});

// Logout
app.post("/logout", (req: Request, res: Response) => {
  res.clearCookie("token");
  res.json({ message: "Logged out successfully 👋" });
});

// Get user by email
app.post("/me", async (req: Request, res: Response) => {
  const { email } = req.body;
  if (!email || !emailRegex.test(email.trim())) {
    return res.status(400).json({ error: "Invalid email" });
  }

  try {
    const user = await User.findOne({ email: email.trim().toLowerCase() }).select("name email");
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json(user);
  } catch (err) {
    console.error("Fetch user error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ================== Error Handling ==================
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ error: "Internal server error" });
});

app.use((req: Request, res: Response) => {
  res.status(404).json({ error: "Route not found" });
});

// ================== Start Server ==================
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));

