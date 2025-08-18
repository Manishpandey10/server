import express, { type Request, type Response } from "express";
import mongoose, { Schema, type Document } from "mongoose";
import bcrypt from "bcryptjs";
import cors from "cors";
import bodyParser from "body-parser";
import jwt from "jsonwebtoken";
import cookieParser from "cookie-parser";

const app = express();
const PORT = process.env.PORT || 5000;




// ================== Middleware ==================
app.use(
  cors({
    origin: ["http://localhost:5173",
    "https://manish-task.vercel.app"],
    
    methods: ["GET", "POST"],
    credentials: true,
  })
);

app.use(cookieParser());

app.use(bodyParser.json());

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

// ================== Validation Functions ==================
const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

const validateRegisterInput = (
  name: string,
  email: string,
  password: string
) => {
  const errors: { name?: string; email?: string; password?: string } = {};

  // Name validation
  if (!name || !name.trim()) {
    errors.name = "Name is required";
  } else if (name.trim().length < 2) {
    errors.name = "Name must be at least 2 characters long";
  } else if (name.trim().length > 50) {
    errors.name = "Name must be less than 50 characters";
  }

  // Email validation
  if (!email || !email.trim()) {
    errors.email = "Email is required";
  } else if (!emailRegex.test(email.trim())) {
    errors.email = "Please enter a valid email address";
  }

  // Password validation
  if (!password) {
    errors.password = "Password is required";
  } else if (password.length < 6) {
    errors.password = "Password must be at least 6 characters long";
  } else if (password.length > 100) {
    errors.password = "Password must be less than 100 characters";
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
};

const validateLoginInput = (email: string, password: string) => {
  const errors: { email?: string; password?: string } = {};

  // Email validation
  if (!email || !email.trim()) {
    errors.email = "Email is required";
  } else if (!emailRegex.test(email.trim())) {
    errors.email = "Please enter a valid email address";
  }

  // Password validation
  if (!password) {
    errors.password = "Password is required";
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
};

// ================== Routes ==================

// Register Route
app.post("/register", async (req: Request, res: Response): Promise<void> => {
  const { name, email, password } = req.body;

  // Input validation
  const validation = validateRegisterInput(name, email, password);
  if (!validation.isValid) {
    res
      .status(400)
      .json({ error: "Validation failed", details: validation.errors });
    return;
  }

  try {
    const trimmedName = name.trim();
    const trimmedEmail = email.trim().toLowerCase();

    // Check for existing user by email
    const existingUserByEmail = await User.findOne({ email: trimmedEmail });
    if (existingUserByEmail) {
      res.status(400).json({ error: "User with this email already exists" });
      return;
    }

    // Check for existing user by name
    const existingUserByName = await User.findOne({ name: trimmedName });
    if (existingUserByName) {
      res.status(400).json({ error: "Username is already taken" });
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const user = new User({
      name: trimmedName,
      email: trimmedEmail,
      password: hashedPassword,
    });

    await user.save();

    res.status(201).json({
      message: "User registered successfully",
      user: { name: user.name, email: user.email },
    });
  } catch (err: any) {
    console.error("Register error:", err);

    // Handle MongoDB duplicate key errors
    if (err.code === 11000) {
      const duplicateField = Object.keys(err.keyPattern)[0];
      if (duplicateField === "email") {
        res.status(400).json({ error: "User with this email already exists" });
      } else if (duplicateField === "name") {
        res.status(400).json({ error: "Username is already taken" });
      } else {
        res.status(400).json({ error: "User already exists" });
      }
      return;
    }

    // Handle validation errors
    if (err.name === "ValidationError") {
      const validationErrors: any = {};
      Object.keys(err.errors).forEach((key) => {
        validationErrors[key] = err.errors[key].message;
      });
      res
        .status(400)
        .json({ error: "Validation failed", details: validationErrors });
      return;
    }

    res.status(500).json({ error: "Something went wrong while registering" });
  }
});

// Login Route
app.post("/login", async (req: Request, res: Response): Promise<void> => {
  const { email, password } = req.body;

  // Input validation
  const validation = validateLoginInput(email, password);
  if (!validation.isValid) {
    res
      .status(400)
      .json({ error: "Validation failed", details: validation.errors });
    return;
  }

  try {
    const trimmedEmail = email.trim().toLowerCase();

    const user = await User.findOne({ email: trimmedEmail });
    if (!user) {
      res.status(400).json({ error: "Invalid email or password" });
      return;
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      res.status(400).json({ error: "Invalid email or password" });
      return;
    }
    // Generate token
    const token = jwt.sign({ id: user._id }, "secret_key", { expiresIn: "1h" });
    // Send token in HTTP-only cookie
    res.cookie("token", token, {
      httpOnly: true,
      secure: false, // set true in production with HTTPS
      sameSite: "strict",
    });

    res.json({
      message: "🎉 Login successful",
      user: { name: user.name, email: user.email },
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Something went wrong while logging in" });
  }
});

// Logout Route
app.post("/logout", (req: Request, res: Response) => {
  res.clearCookie("token");
  res.json({ message: "👋 Logged out successfully" });
});

// User details route - Simple version using email from request body
app.post("/me", async (req: Request, res: Response): Promise<void> => {
  try {
    const { email } = req.body;

    if (!email || !email.trim()) {
      res.status(400).json({ error: "Email is required" });
      return;
    }

    if (!emailRegex.test(email.trim())) {
      res.status(400).json({ error: "Invalid email format" });
      return;
    }

    const user = await User.findOne({
      email: email.trim().toLowerCase(),
    }).select("name email");
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    res.json({ name: user.name, email: user.email });
  } catch (err) {
    console.error("Error fetching user:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// Health check route
app.get("/health", (req: Request, res: Response): void => {
  res.json({
    status: "Server is running",
    timestamp: new Date().toISOString(),
  });
});

// ================== Error Handling Middleware ==================
app.use((err: Error, req: Request, res: Response, next: any) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ error: "Internal server error" });
});

// Handle 404 routes
app.use((req: Request, res: Response) => {
  res.status(404).json({ error: "Route not found" });
});

// ================== Start Server ==================
app.listen(PORT, () =>
  console.log(`🚀 Server running on port ${PORT}`)
);