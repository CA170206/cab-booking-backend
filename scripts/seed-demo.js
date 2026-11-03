const bcrypt = require("bcryptjs");
const defaultPool = require("../db");

async function ensureDemoAccounts(customPool = null) {
  const pool = customPool || defaultPool;
  const isDirectRun = !customPool;

  try {
    const passwordHash = await bcrypt.hash("password123", 12);

    // 1. Guest Passenger Account
    await pool.query(
      `INSERT INTO profiles (full_name, email, phone, role, password_hash)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (email) DO UPDATE
       SET role = 'rider', password_hash = $5
       RETURNING id, full_name, email, role;`,
      [
        "Guest Passenger",
        "guest.passenger@ridego.com",
        "+91 98765 43210",
        "rider",
        passwordHash,
      ]
    );

    // 2. Demo Rider (legacy compat)
    await pool.query(
      `INSERT INTO profiles (full_name, email, phone, role, password_hash)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (email) DO UPDATE
       SET role = 'rider', password_hash = $5
       RETURNING id, full_name, email, role;`,
      [
        "Demo Passenger",
        "rider.demo@cabgo.com",
        "+91 98765 43210",
        "rider",
        passwordHash,
      ]
    );

    // 3. Registered Driver (Suresh Gaikwad)
    await pool.query(
      `INSERT INTO profiles (full_name, email, phone, role, password_hash, vehicle_model, vehicle_number, upi_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (email) DO UPDATE
       SET role = 'driver', full_name = $1, password_hash = $5, vehicle_model = $6, vehicle_number = $7, upi_id = $8
       RETURNING id, full_name, email, role;`,
      [
        "Suresh Gaikwad",
        "driver@ridego.com",
        "+91 98220 12345",
        "driver",
        passwordHash,
        "White Maruti Swift Dzire",
        "MH 15 AB 1234",
        "ridego.driver@okhdfcbank",
      ]
    );

    // 4. Legacy driver email compat
    await pool.query(
      `INSERT INTO profiles (full_name, email, phone, role, password_hash, vehicle_model, vehicle_number, upi_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (email) DO UPDATE
       SET role = 'driver', full_name = $1, password_hash = $5, vehicle_model = $6, vehicle_number = $7, upi_id = $8
       RETURNING id, full_name, email, role;`,
      [
        "Suresh Gaikwad",
        "driver.demo@cabgo.com",
        "+91 98220 12345",
        "driver",
        passwordHash,
        "White Maruti Swift Dzire",
        "MH 15 AB 1234",
        "ridego.driver@okhdfcbank",
      ]
    );

    console.log("Verified demo accounts (passenger & driver) in database.");
  } catch (err) {
    console.error("Seed error:", err.message);
    if (isDirectRun) {
      process.exit(1);
    }
    throw err;
  } finally {
    if (isDirectRun) {
      await pool.end();
    }
  }
}

if (require.main === module) {
  ensureDemoAccounts();
}

module.exports = { ensureDemoAccounts };
