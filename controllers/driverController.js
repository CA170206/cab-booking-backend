
const pool = require("../db");

// Get rides that are waiting for a driver.
const getAvailableRides = async (req, res) => {
  try {
    if (req.user.role !== "driver") {
      return res.status(403).json({
        success: false,
        message: "Only drivers can view available rides.",
      });
    }

    const result = await pool.query(
      `SELECT
         id,
         pickup_address,
         dropoff_address,
         pickup_lat,
         pickup_lng,
         dropoff_lat,
         dropoff_lng,
         estimated_fare,
         status,
         created_at
       FROM rides
       WHERE status = 'requested'
         AND driver_id IS NULL
       ORDER BY created_at ASC`
    );

    return res.status(200).json({
      success: true,
      count: result.rows.length,
      rides: result.rows,
    });
  } catch (error) {
    console.error("Available rides error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to retrieve available rides.",
    });
  }
};

// Accept a ride. The database update prevents two drivers
// from successfully accepting the same ride.
const acceptRide = async (req, res) => {
  try {
    if (req.user.role !== "driver") {
      return res.status(403).json({
        success: false,
        message: "Only drivers can accept rides.",
      });
    }

    const { rideId } = req.params;

    if (
      typeof rideId !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(rideId)
    ) {
      return res.status(400).json({
        success: false,
        message: "A valid ride ID is required.",
      });
    }

    const result = await pool.query(
      `UPDATE rides
       SET driver_id = $1,
           status = 'accepted'
       WHERE id = $2
         AND status = 'requested'
         AND driver_id IS NULL
       RETURNING *`,
      [req.user.id, rideId]
    );

    if (result.rows.length === 0) {
      return res.status(409).json({
        success: false,
        message: "This ride is unavailable or has already been accepted.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Ride accepted successfully.",
      ride: result.rows[0],
    });
  } catch (error) {
    console.error("Accept ride error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to accept ride.",
    });
  }
};


const updateRideStatus = async (req, res) => {
  try {
    if (req.user.role !== "driver") {
      return res.status(403).json({
        success: false,
        message: "Only drivers can update ride status.",
      });
    }

    const { rideId } = req.params;

if (
  typeof rideId !== "string" ||
  !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(rideId)
) {
  return res.status(400).json({
    success: false,
    message: "A valid ride ID is required.",
  });
}

const { status } = req.body || {};

    const allowedTransitions = {
      arriving: "accepted",
  in_progress: "arriving",
  completed: "in_progress",
    };

    if (!allowedTransitions[status]) {
      return res.status(400).json({
        success: false,
        message: "Invalid next ride status.",
      });
    }

    const result = await pool.query(
      `UPDATE rides
       SET status = $1
       WHERE id = $2
         AND driver_id = $3
         AND status = $4
       RETURNING *`,
      [status, rideId, req.user.id, allowedTransitions[status]]
    );

    if (result.rows.length === 0) {
      return res.status(409).json({
        success: false,
        message: "Ride not found, not assigned to you, or transition not allowed.",
      });
    }

    return res.status(200).json({
      success: true,
      message: `Ride status updated to ${status}.`,
      ride: result.rows[0],
    });
  } catch (error) {
    console.error("Update ride status error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to update ride status.",
    });
  }
};


module.exports = {
  getAvailableRides,
  acceptRide,
  updateRideStatus,
};
