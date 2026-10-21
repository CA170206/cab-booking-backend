const pool = require("../db");

/**
 * GET /api/profile
 * Retrieve authenticated user profile with stats
 */
const getProfile = async (req, res) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
    }

    const userResult = await pool.query(
      `SELECT id, full_name, email, phone, role,
              vehicle_model, vehicle_number, upi_id,
              emergency_phone, home_address, work_address,
              preferred_payment, preferred_vehicle,
              license_number, vehicle_category, service_area,
              rating, total_ratings, created_at
       FROM profiles
       WHERE id = $1`,
      [req.user.id]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "User profile not found.",
      });
    }

    const profile = userResult.rows[0];

    // Compute real ride statistics from database
    let stats = { total_rides: 0, completed_rides: 0, total_amount: 0 };
    if (profile.role === "driver") {
      const statsRes = await pool.query(
        `SELECT
           COUNT(*)::int AS total_rides,
           COUNT(CASE WHEN status = 'completed' THEN 1 END)::int AS completed_rides,
           COALESCE(SUM(CASE WHEN status = 'completed' THEN estimated_fare ELSE 0 END), 0)::float AS total_amount
         FROM rides
         WHERE driver_id = $1`,
        [req.user.id]
      );
      if (statsRes.rows.length > 0) {
        stats = statsRes.rows[0];
      }
    } else {
      const statsRes = await pool.query(
        `SELECT
           COUNT(*)::int AS total_rides,
           COUNT(CASE WHEN status = 'completed' THEN 1 END)::int AS completed_rides,
           COALESCE(SUM(CASE WHEN status = 'completed' THEN estimated_fare ELSE 0 END), 0)::float AS total_amount
         FROM rides
         WHERE rider_id = $1`,
        [req.user.id]
      );
      if (statsRes.rows.length > 0) {
        stats = statsRes.rows[0];
      }
    }

    return res.status(200).json({
      success: true,
      profile: {
        ...profile,
        stats,
      },
    });
  } catch (error) {
    console.error("Get profile error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Unable to retrieve profile details.",
    });
  }
};

/**
 * PUT /api/profile
 * Update user profile details
 */
const updateProfile = async (req, res) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
    }

    const {
      full_name,
      phone,
      emergency_phone,
      home_address,
      work_address,
      preferred_payment,
      preferred_vehicle,
      license_number,
      vehicle_model,
      vehicle_number,
      vehicle_category,
      service_area,
      upi_id,
    } = req.body || {};

    const updates = [];
    const values = [];
    let paramIndex = 1;

    if (typeof full_name === "string" && full_name.trim()) {
      updates.push(`full_name = $${paramIndex++}`);
      values.push(full_name.trim());
    }

    if (typeof phone === "string") {
      updates.push(`phone = $${paramIndex++}`);
      values.push(phone.trim() || null);
    }

    // Passenger details
    if (typeof emergency_phone === "string") {
      updates.push(`emergency_phone = $${paramIndex++}`);
      values.push(emergency_phone.trim() || null);
    }

    if (typeof home_address === "string") {
      updates.push(`home_address = $${paramIndex++}`);
      values.push(home_address.trim() || null);
    }

    if (typeof work_address === "string") {
      updates.push(`work_address = $${paramIndex++}`);
      values.push(work_address.trim() || null);
    }

    if (typeof preferred_payment === "string") {
      updates.push(`preferred_payment = $${paramIndex++}`);
      values.push(preferred_payment.trim() || null);
    }

    if (typeof preferred_vehicle === "string") {
      updates.push(`preferred_vehicle = $${paramIndex++}`);
      values.push(preferred_vehicle.trim() || null);
    }

    // Driver details
    if (typeof license_number === "string") {
      updates.push(`license_number = $${paramIndex++}`);
      values.push(license_number.trim() || null);
    }

    if (typeof vehicle_model === "string") {
      updates.push(`vehicle_model = $${paramIndex++}`);
      values.push(vehicle_model.trim() || null);
    }

    if (typeof vehicle_number === "string") {
      updates.push(`vehicle_number = $${paramIndex++}`);
      values.push(vehicle_number.trim() || null);
    }

    if (typeof vehicle_category === "string") {
      updates.push(`vehicle_category = $${paramIndex++}`);
      values.push(vehicle_category.trim() || null);
    }

    if (typeof service_area === "string") {
      updates.push(`service_area = $${paramIndex++}`);
      values.push(service_area.trim() || null);
    }

    if (typeof upi_id === "string") {
      updates.push(`upi_id = $${paramIndex++}`);
      values.push(upi_id.trim() || null);
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No valid profile fields provided for update.",
      });
    }

    values.push(req.user.id);
    const query = `
      UPDATE profiles
      SET ${updates.join(", ")}
      WHERE id = $${paramIndex}
      RETURNING id, full_name, email, phone, role,
                vehicle_model, vehicle_number, upi_id,
                emergency_phone, home_address, work_address,
                preferred_payment, preferred_vehicle,
                license_number, vehicle_category, service_area,
                rating, total_ratings, created_at
    `;

    const result = await pool.query(query, values);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Profile not found.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Profile updated successfully.",
      profile: result.rows[0],
    });
  } catch (error) {
    console.error("Update profile error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Unable to update profile details.",
    });
  }
};

module.exports = {
  getProfile,
  updateProfile,
};
