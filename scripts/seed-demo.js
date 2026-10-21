const bcrypt = require("bcryptjs");
const pool = require("../db");

async function ensureDemoAccounts() {
  try {
    const passwordHash = await bcrypt.hash("password123", 12);

    // 1. Demo Rider
    await pool.query(
      `INSERT INTO profiles (full_name, email, phone, role, password_hash)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (email) DO UPDATE
       SET role = 'rider', password_hash = $5
       RETURNING id, full_name, email, role;`,
      [
        "Demo Rider",
        "rider.demo@cabgo.com",
        "+91 98765 43210",
        "rider",
        passwordHash,
      ]
    );
    console.log("Verified Demo Rider: rider.demo@cabgo.com / password123");

    // 2. Demo Driver
    await pool.query(
      `INSERT INTO profiles (full_name, email, phone, role, password_hash)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (email) DO UPDATE
       SET role = 'driver', password_hash = $5
       RETURNING id, full_name, email, role;`,
      [
        "Suresh Gaikwad (Demo Driver)",
        "driver.demo@cabgo.com",
        "+91 98220 12345",
        "driver",
        passwordHash,
      ]
    );
    console.log("Verified Demo Driver: driver.demo@cabgo.com / password123");
  } catch (err) {
    console.error("Seed error:", err.message);
  } finally {
    await pool.end();
  }
}

ensureDemoAccounts();
