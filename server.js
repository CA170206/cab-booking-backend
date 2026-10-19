const { authLimiter } = require("./middleware/rateLimitMiddleware");
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const authRoutes = require("./routes/authRoutes");
const rideRoutes = require("./routes/rideRoutes");
const driverRoutes = require("./routes/driverRoutes");
require("dotenv").config();

const pool = require("./db");

const app = express();
const PORT = process.env.PORT || 5000;


app.use(helmet());
app.use(cors({
  origin: ["http://localhost:3000", "http://127.0.0.1:3000"],
  credentials: true,
}));
app.use(express.json());
app.use("/api/auth", authLimiter, authRoutes);
app.use("/api/rides", rideRoutes);
app.use("/api/driver", driverRoutes);
app.use(morgan("dev"));

app.get("/", (req, res) => {
  res.json({ message: "CabGo API is running!" });
});

app.get("/api/health", async (req, res) => {
  try {
    const result = await pool.query("SELECT NOW() AS database_time");

    res.json({
      success: true,
      message: "Backend connected to PostgreSQL!",
      databaseTime: result.rows[0].database_time,
    });
  } catch (error) {
    console.error("Database connection failed:", error.message);
    res.status(500).json({
      success: false,
      message: "Database connection failed",
    });
  }
});

app.listen(PORT, () => {
  console.log(`CabGo backend running at http://localhost:${PORT}`);
});
