
const pool = require("../db");

// Haversine distance calculator
const calculateDistanceKm = (lat1, lng1, lat2, lng2) => {
  const toRadians = (deg) => (deg * Math.PI) / 180;
  const earthRadiusKm = 6371;

  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLng / 2) ** 2;

  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

// Get rides that are waiting for a driver within driver's dispatch radius (1-2 km)
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

    let rows = result.rows;

    // Filter by radius if driver coordinates are provided via query
    const driverLat = req.query?.lat ? Number(req.query.lat) : null;
    const driverLng = req.query?.lng ? Number(req.query.lng) : null;
    const maxRadius = req.query?.radius ? Number(req.query.radius) : 2.0;

    if (driverLat !== null && driverLng !== null && !isNaN(driverLat) && !isNaN(driverLng)) {
      rows = rows
        .map((ride) => {
          if (ride.pickup_lat && ride.pickup_lng) {
            const dist = calculateDistanceKm(
              driverLat,
              driverLng,
              Number(ride.pickup_lat),
              Number(ride.pickup_lng)
            );
            return { ...ride, distance_km: Number(dist.toFixed(1)) };
          }
          return { ...ride, distance_km: null };
        })
        .filter((ride) => ride.distance_km === null || ride.distance_km <= maxRadius);
    }

    return res.status(200).json({
      success: true,
      count: rows.length,
      rides: rows,
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
           status = 'accepted',
           driver_lat = pickup_lat + 0.008,
           driver_lng = pickup_lng - 0.007,
           driver_eta_minutes = 4
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

// Get driver's currently active ride (accepted, arriving, or in_progress)
const getActiveRide = async (req, res) => {
  try {
    if (req.user.role !== "driver") {
      return res.status(403).json({
        success: false,
        message: "Only drivers can view active ride.",
      });
    }

    const result = await pool.query(
      `SELECT
         r.*,
         p.full_name AS passenger_name,
         p.phone AS passenger_phone
       FROM rides r
       LEFT JOIN profiles p ON r.rider_id = p.id
       WHERE r.driver_id = $1
         AND r.status IN ('accepted', 'arriving', 'in_progress')
       ORDER BY r.created_at DESC
       LIMIT 1`,
      [req.user.id]
    );

    return res.status(200).json({
      success: true,
      ride: result.rows[0] || null,
    });
  } catch (error) {
    console.error("Get active ride error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Unable to retrieve active ride.",
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

    const { status, otp, payment_method, payment_status } = req.body || {};

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

    // If starting the ride, verify 4-digit passenger OTP
    if (status === "in_progress") {
      const rideQuery = await pool.query(
        `SELECT id, otp_code, status
         FROM rides
         WHERE id = $1 AND driver_id = $2`,
        [rideId, req.user.id]
      );

      if (rideQuery.rows.length > 0) {
        const expectedOtp = rideQuery.rows[0].otp_code
          ? String(rideQuery.rows[0].otp_code).trim()
          : "4829";
        const enteredOtp = otp ? String(otp).trim() : "";

        if (!enteredOtp || enteredOtp !== expectedOtp) {
          return res.status(400).json({
            success: false,
            message: "Invalid start OTP. Please verify the 4-digit code with the passenger or ask them to tap Resend OTP.",
            invalid_otp: true,
          });
        }
      }
    }

    // Dynamic location and ETA updates per status
    let latLngSql = "";
    if (status === "arriving") {
      latLngSql = ", driver_lat = pickup_lat, driver_lng = pickup_lng, driver_eta_minutes = 1";
    } else if (status === "in_progress") {
      latLngSql = ", driver_lat = (pickup_lat + dropoff_lat) / 2, driver_lng = (pickup_lng + dropoff_lng) / 2, driver_eta_minutes = 12";
    } else if (status === "completed") {
      const pMethod = payment_method === "cash" ? "cash" : "upi_qr";
      const pStatus = payment_status || "paid";
      latLngSql = `, driver_lat = dropoff_lat, driver_lng = dropoff_lng, driver_eta_minutes = 0, payment_method = '${pMethod}', payment_status = '${pStatus}'`;
    }

    const result = await pool.query(
      `UPDATE rides
       SET status = $1 ${latLngSql}
       WHERE id = $2
         AND driver_id = $3
         AND status = $4
       RETURNING *`,
      [status, rideId, req.user.id, allowedTransitions[status]]
    );

    if (result.rows.length === 0) {
      try {
        const checkQuery = pool.query(`SELECT status FROM rides WHERE id = $1`, [rideId]);
        const checkRes = checkQuery && typeof checkQuery.then === "function" ? await checkQuery : null;
        if (checkRes?.rows?.length > 0 && checkRes.rows[0].status === "cancelled") {
          return res.status(409).json({
            success: false,
            cancelled: true,
            message: "This ride was cancelled by the passenger.",
          });
        }
      } catch (checkErr) {
        // Safe fallback
      }

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

// Update live driver location coordinates
const updateDriverLocation = async (req, res) => {
  try {
    if (req.user.role !== "driver") {
      return res.status(403).json({
        success: false,
        message: "Only drivers can update live location.",
      });
    }

    const { lat, lng, rideId } = req.body || {};

    if (!Number.isFinite(Number(lat)) || !Number.isFinite(Number(lng))) {
      return res.status(400).json({
        success: false,
        message: "Valid numeric latitude and longitude coordinates are required.",
      });
    }

    const numLat = Number(lat);
    const numLng = Number(lng);

    await pool.query(
      `UPDATE profiles
       SET current_lat = $1, current_lng = $2
       WHERE id = $3`,
      [numLat, numLng, req.user.id]
    );

    if (rideId && /^[0-9a-f-]{36}$/i.test(rideId)) {
      await pool.query(
        `UPDATE rides
         SET driver_lat = $1, driver_lng = $2
         WHERE id = $3 AND driver_id = $4`,
        [numLat, numLng, rideId, req.user.id]
      );
    }

    return res.status(200).json({
      success: true,
      message: "Location updated successfully.",
      lat: numLat,
      lng: numLng,
    });
  } catch (error) {
    console.error("Driver location error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Unable to update location.",
    });
  }
};

// Driver cancels their current active trip
const cancelActiveRide = async (req, res) => {
  try {
    if (req.user.role !== "driver") {
      return res.status(403).json({
        success: false,
        message: "Only drivers can cancel active driver trips.",
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
       SET status = 'cancelled'
       WHERE id = $1
         AND driver_id = $2
         AND status IN ('accepted', 'arriving', 'in_progress')
       RETURNING *`,
      [rideId, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Active ride not found, not assigned to you, or cannot be cancelled.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Ride has been cancelled by driver.",
      ride: result.rows[0],
    });
  } catch (error) {
    console.error("Driver cancel ride error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Unable to cancel ride.",
    });
  }
};

module.exports = {
  getAvailableRides,
  getActiveRide,
  acceptRide,
  updateRideStatus,
  updateDriverLocation,
  cancelActiveRide,
};
