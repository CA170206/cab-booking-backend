
const pool = require("../db");

const calculateDistanceKm = (lat1, lng1, lat2, lng2) => {
  const toRadians = (degrees) => (degrees * Math.PI) / 180;
  const earthRadiusKm = 6371;

  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLng / 2) ** 2;

  return earthRadiusKm * 2 * Math.atan2(
    Math.sqrt(a),
    Math.sqrt(1 - a)
  );
};

const calculateFare = (distanceKm) => {
  const baseFare = 40;
  const perKmRate = 15;
  const minimumFare = 60;

  return Number(
    Math.max(minimumFare, baseFare + distanceKm * perKmRate).toFixed(2)
  );
};

const requestRide = async (req, res) => {
  try {
    if (req.user.role !== "rider") {
      return res.status(403).json({
        success: false,
        message: "Only riders can request rides.",
      });
    }

    const {
      pickup_address,
      dropoff_address,
      pickup_lat,
      pickup_lng,
      dropoff_lat,
      dropoff_lng,
    } = req.body;

    if (
      typeof pickup_address !== "string" ||
      !pickup_address.trim() ||
      pickup_address.trim().length > 500 ||
      typeof dropoff_address !== "string" ||
      !dropoff_address.trim() ||
      dropoff_address.trim().length > 500
    ) {
      return res.status(400).json({
        success: false,
        message: "Valid pickup and drop-off addresses are required (maximum 500 characters each).",
      });
    }

    const coordinates = [
      pickup_lat,
      pickup_lng,
      dropoff_lat,
      dropoff_lng,
    ];

    const coordinateNames = [
      "pickup_lat",
      "pickup_lng",
      "dropoff_lat",
      "dropoff_lng",
    ];

    const parsedCoordinates = [];

    for (let i = 0; i < coordinates.length; i++) {
      const value = coordinates[i];

      if (
        value === undefined ||
        value === null ||
        value === "" ||
        !Number.isFinite(Number(value))
      ) {
        return res.status(400).json({
          success: false,
          message: `A valid ${coordinateNames[i]} coordinate is required for fare estimation.`,
        });
      }

      const number = Number(value);
      const min = i % 2 === 0 ? -90 : -180;
      const max = i % 2 === 0 ? 90 : 180;

      if (number < min || number > max) {
        return res.status(400).json({
          success: false,
          message: `Invalid coordinate: ${coordinateNames[i]}.`,
        });
      }

      parsedCoordinates.push(number);
    }

    const [pickupLat, pickupLng, dropoffLat, dropoffLng] =
      parsedCoordinates;

    const distanceKm = calculateDistanceKm(
      pickupLat,
      pickupLng,
      dropoffLat,
      dropoffLng
    );

    const estimatedFare = calculateFare(distanceKm);
    // Generate a secure 4-digit ride start OTP
    const otpCode = Math.floor(1000 + Math.random() * 9000).toString();

    const result = await pool.query(
      `INSERT INTO rides (
        rider_id,
        pickup_address,
        dropoff_address,
        pickup_lat,
        pickup_lng,
        dropoff_lat,
        dropoff_lng,
        estimated_fare,
        otp_code
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *`,
      [
        req.user.id,
        pickup_address.trim(),
        dropoff_address.trim(),
        pickupLat,
        pickupLng,
        dropoffLat,
        dropoffLng,
        estimatedFare,
        otpCode,
      ]
    );

    return res.status(201).json({
      success: true,
      message: "Ride requested successfully.",
      distance_km: Number(distanceKm.toFixed(2)),
      estimated_fare: estimatedFare,
      fare_currency: "INR",
      ride: result.rows[0],
    });
  } catch (error) {
    console.error("Request ride error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to request ride.",
    });
  }
};

const getMyRides = async (req, res) => {
  try {
    if (req.user.role !== "rider") {
      return res.status(403).json({
        success: false,
        message: "This endpoint is for riders only.",
      });
    }

    const result = await pool.query(
      `SELECT
         r.*,
         p.full_name AS driver_name,
         p.phone AS driver_phone,
         p.vehicle_model AS driver_vehicle_model,
         p.vehicle_number AS driver_vehicle_number,
         p.upi_id AS driver_upi_id,
         p.rating AS driver_rating,
         p.total_ratings AS driver_total_ratings
       FROM rides r
       LEFT JOIN profiles p ON r.driver_id = p.id
       WHERE rider_id = $1
       ORDER BY r.created_at DESC`,
      [req.user.id]
    );

    return res.status(200).json({
      success: true,
      count: result.rows.length,
      rides: result.rows,
    });
  } catch (error) {
    console.error("Get rides error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to retrieve rides.",
    });
  }
};

// Get single ride details (for live tracking, OTP, and bill receipt)
const getRideDetails = async (req, res) => {
  try {
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
      `SELECT
         r.*,
         p.full_name AS driver_name,
         p.phone AS driver_phone,
         p.vehicle_model AS driver_vehicle_model,
         p.vehicle_number AS driver_vehicle_number,
         p.upi_id AS driver_upi_id,
         p.rating AS driver_rating,
         p.total_ratings AS driver_total_ratings
       FROM rides r
       LEFT JOIN profiles p ON r.driver_id = p.id
       WHERE r.id = $1`,
      [rideId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Ride not found.",
      });
    }

    const ride = result.rows[0];

    // Must be rider or assigned driver
    if (
      req.user.id !== ride.rider_id &&
      req.user.id !== ride.driver_id &&
      req.user.role !== "admin"
    ) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to view this ride.",
      });
    }

    return res.status(200).json({
      success: true,
      ride,
    });
  } catch (error) {
    console.error("Get ride details error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Unable to retrieve ride details.",
    });
  }
};

// Resend / regenerate 4-digit start OTP
const resendOtp = async (req, res) => {
  try {
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

    const newOtp = Math.floor(1000 + Math.random() * 9000).toString();

    const result = await pool.query(
      `UPDATE rides
       SET otp_code = $1
       WHERE id = $2
         AND rider_id = $3
         AND status IN ('requested', 'accepted', 'arriving')
       RETURNING *`,
      [newOtp, rideId, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Cannot resend OTP. Ride is already in progress, completed, or not found.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "New 4-digit start OTP generated.",
      otp_code: newOtp,
      ride: result.rows[0],
    });
  } catch (error) {
    console.error("Resend OTP error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Unable to resend OTP.",
    });
  }
};

// Rate driver partner (1 to 5 stars)
const rateRide = async (req, res) => {
  try {
    const { rideId } = req.params;
    const { rating, feedback_tags, review_comment } = req.body || {};

    if (
      typeof rideId !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(rideId)
    ) {
      return res.status(400).json({
        success: false,
        message: "A valid ride ID is required.",
      });
    }

    const numRating = Number(rating);
    if (!numRating || numRating < 1 || numRating > 5) {
      return res.status(400).json({
        success: false,
        message: "A rating between 1 and 5 stars is required.",
      });
    }

    const tags = Array.isArray(feedback_tags) ? feedback_tags : [];
    const review = typeof review_comment === "string" ? review_comment.trim() : "";

    const rideRes = await pool.query(
      `UPDATE rides
       SET rating = $1,
           feedback_tags = $2,
           review_comment = $3
       WHERE id = $4
         AND rider_id = $5
         AND status = 'completed'
       RETURNING *`,
      [numRating, tags, review, rideId, req.user.id]
    );

    if (rideRes.rows.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Ride not found, unauthorized, or not in completed state.",
      });
    }

    const ride = rideRes.rows[0];

    // Update driver partner overall rating in profiles with real calculation
    if (ride.driver_id) {
      try {
        await pool.query(
          `UPDATE profiles
           SET rating = CASE
                          WHEN total_ratings IS NULL OR total_ratings = 0 THEN $1::numeric
                          ELSE ROUND(((rating * total_ratings + $1) / (total_ratings + 1))::numeric, 2)
                        END,
               total_ratings = COALESCE(total_ratings, 0) + 1
           WHERE id = $2`,
          [numRating, ride.driver_id]
        );
      } catch (profErr) {
        console.warn("Could not update driver overall rating:", profErr.message);
      }
    }

    return res.status(200).json({
      success: true,
      message: "Thank you for rating your driver partner!",
      rating: numRating,
      ride,
    });
  } catch (error) {
    console.error("Rate ride error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Unable to submit driver rating.",
    });
  }
};

// Cancel ride request (allowed while looking for a driver or before trip starts)
const cancelRide = async (req, res) => {
  try {
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

    const checkRes = await pool.query(
      `SELECT id, rider_id, driver_id, status FROM rides WHERE id = $1`,
      [rideId]
    );

    if (checkRes.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Ride not found.",
      });
    }

    const ride = checkRes.rows[0];

    if (
      ride.rider_id !== req.user.id &&
      ride.driver_id !== req.user.id &&
      req.user.role !== "admin"
    ) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to cancel this ride.",
      });
    }

    if (["completed", "cancelled"].includes(ride.status)) {
      return res.status(400).json({
        success: false,
        message: `Ride is already ${ride.status}.`,
      });
    }

    const updateRes = await pool.query(
      `UPDATE rides
       SET status = 'cancelled'
       WHERE id = $1
       RETURNING *`,
      [rideId]
    );

    return res.status(200).json({
      success: true,
      message: "Ride request cancelled successfully.",
      ride: updateRes.rows[0],
    });
  } catch (error) {
    console.error("Cancel ride error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Unable to cancel ride.",
    });
  }
};

// Get public reviews and platform statistics from real rides
const getPublicReviewsAndStats = async (req, res) => {
  try {
    const reviewsRes = await pool.query(
      `SELECT r.id, r.rating, r.feedback_tags, r.review_comment,
              r.pickup_address, r.dropoff_address, r.created_at,
              COALESCE(p.full_name, 'Verified Passenger') AS passenger_name
       FROM rides r
       LEFT JOIN profiles p ON r.rider_id = p.id
       WHERE r.rating IS NOT NULL
       ORDER BY r.created_at DESC
       LIMIT 6`
    );

    const statsRes = await pool.query(
      `SELECT
         COUNT(CASE WHEN status = 'completed' THEN 1 END)::int AS total_completed_rides,
         COUNT(DISTINCT driver_id)::int AS total_active_drivers,
         COUNT(DISTINCT rider_id)::int AS total_passengers,
         COALESCE(ROUND(AVG(rating)::numeric, 1), 5.0)::float AS average_rating
       FROM rides`
    );

    const platformStats = statsRes.rows[0] || {
      total_completed_rides: 0,
      total_active_drivers: 0,
      total_passengers: 0,
      average_rating: 5.0,
    };

    return res.status(200).json({
      success: true,
      reviews: reviewsRes.rows,
      stats: platformStats,
    });
  } catch (error) {
    console.error("Get reviews error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Unable to retrieve platform reviews.",
    });
  }
};

module.exports = {
  requestRide,
  getMyRides,
  getRideDetails,
  resendOtp,
  rateRide,
  cancelRide,
  getPublicReviewsAndStats,
};

