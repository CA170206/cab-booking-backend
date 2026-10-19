
const express = require("express");
const authMiddleware = require("../middleware/authMiddleware");

const {
  getAvailableRides,
  acceptRide,
  updateRideStatus,
} = require("../controllers/driverController");

const router = express.Router();

router.get("/rides/available", authMiddleware, getAvailableRides);

router.patch(
  "/rides/:rideId/accept",
  authMiddleware,
  acceptRide
);

router.patch(
  "/rides/:rideId/status",
  authMiddleware,
  updateRideStatus
);

module.exports = router;
