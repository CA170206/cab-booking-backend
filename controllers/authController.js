
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const pool = require("../db");

const register = async (req, res) => {
  try {
    const { full_name, email, phone, password, role } = req.body;

    if (
      typeof full_name !== "string" ||
      !full_name.trim() ||
      typeof email !== "string" ||
      !email.trim() ||
      typeof password !== "string" ||
      !password ||
      !role
    ) {
      return res.status(400).json({
        success: false,
        message: "Full name, email, password, and role are required.",
      });
    }

    if (!["rider", "driver"].includes(role)) {
      return res.status(400).json({
        success: false,
        message: "Role must be rider or driver.",
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        message: "Password must contain at least 8 characters.",
      });
    }

    if (full_name.trim().length > 100) {
      return res.status(400).json({
        success: false,
        message: "Full name must be 100 characters or fewer.",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    if (
      normalizedEmail.length > 255 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)
    ) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid email address.",
      });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const result = await pool.query(
      `INSERT INTO profiles
        (full_name, email, phone, role, password_hash)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, full_name, email, phone, role, created_at`,
      [
        full_name.trim(),
        normalizedEmail,
        typeof phone === "string" && phone.trim()
          ? phone.trim()
          : null,
        role,
        passwordHash,
      ]
    );

    return res.status(201).json({
      success: true,
      message: "Account created successfully.",
      user: result.rows[0],
    });
  } catch (error) {
    if (error.code === "23505") {
      return res.status(409).json({
        success: false,
        message: "An account with this email already exists.",
      });
    }

    console.error("Registration error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to register account.",
    });
  }
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (
      typeof email !== "string" ||
      !email.trim() ||
      typeof password !== "string" ||
      !password
    ) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required.",
      });
    }

    const result = await pool.query(
      `SELECT id, full_name, email, phone, role, password_hash
       FROM profiles
       WHERE email = $1`,
      [email.trim().toLowerCase()]
    );

    const user = result.rows[0];

    // Use the same response for unknown emails and incorrect passwords.
    if (
      !user ||
      !user.password_hash ||
      !(await bcrypt.compare(password, user.password_hash))
    ) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password.",
      });
    }

    if (!process.env.JWT_SECRET) {
      console.error("JWT_SECRET is missing from the environment.");
      return res.status(500).json({
        success: false,
        message: "Authentication is not configured.",
      });
    }

    const token = jwt.sign(
      { role: user.role },
      process.env.JWT_SECRET,
      {
        subject: user.id,
        expiresIn: "1d",
      }
    );

    const { password_hash, ...safeUser } = user;

    return res.status(200).json({
      success: true,
      message: "Login successful.",
      token,
      user: safeUser,
    });
  } catch (error) {
    console.error("Login error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to log in.",
    });
  }
};

const guestLogin = async (req, res) => {
  try {
    const { name, phone } = req.body || {};
    const guestEmail = "guest.passenger@ridego.com";

    let result = await pool.query(
      `SELECT id, full_name, email, phone, role FROM profiles WHERE email = $1`,
      [guestEmail]
    );

    let user;
    if (result.rows.length === 0) {
      const ins = await pool.query(
        `INSERT INTO profiles (full_name, email, phone, role)
         VALUES ($1, $2, $3, 'rider')
         RETURNING id, full_name, email, phone, role`,
        [
          name && typeof name === "string" && name.trim() ? name.trim() : "Guest Passenger",
          guestEmail,
          phone && typeof phone === "string" && phone.trim() ? phone.trim() : "+91 98765 43210",
        ]
      );
      user = ins.rows[0];
    } else {
      user = result.rows[0];
      if (name && typeof name === "string" && name.trim()) {
        user.full_name = name.trim();
        await pool.query(`UPDATE profiles SET full_name = $1 WHERE id = $2`, [name.trim(), user.id]);
      }
      if (phone && typeof phone === "string" && phone.trim()) {
        user.phone = phone.trim();
        await pool.query(`UPDATE profiles SET phone = $1 WHERE id = $2`, [phone.trim(), user.id]);
      }
    }

    if (!process.env.JWT_SECRET) {
      return res.status(500).json({
        success: false,
        message: "Authentication is not configured.",
      });
    }

    const token = jwt.sign(
      { role: "rider", isGuest: true },
      process.env.JWT_SECRET,
      {
        subject: user.id,
        expiresIn: "7d",
      }
    );

    return res.status(200).json({
      success: true,
      message: "Logged in as Guest Passenger.",
      token,
      user: {
        ...user,
        role: "rider",
        isGuest: true,
      },
    });
  } catch (error) {
    console.error("Guest login error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Unable to start guest session.",
    });
  }
};

module.exports = { register, login, guestLogin };

