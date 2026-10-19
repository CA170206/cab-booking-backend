
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

    const result = await pool.query(
      `INSERT INTO rides (
        rider_id,
        pickup_address,
        dropoff_address,
        pickup_lat,
        pickup_lng,
        dropoff_lat,
        dropoff_lng,
        estimated_fare
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
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
      `SELECT *
       FROM rides
       WHERE rider_id = $1
       ORDER BY created_at DESC`,
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

module.exports = { requestRide, getMyRides };
