
const express = require("express");
const authMiddleware = require("../middleware/authMiddleware");

const {
  getAvailableRides,
  getActiveRide,
  acceptRide,
  updateRideStatus,
  updateDriverLocation,
  cancelActiveRide,
} = require("../controllers/driverController");

const router = express.Router();

router.get("/rides/available", authMiddleware, getAvailableRides);
router.get("/rides/active", authMiddleware, getActiveRide);
router.patch("/rides/:rideId/accept", authMiddleware, acceptRide);
router.patch("/rides/:rideId/status", authMiddleware, updateRideStatus);
router.post("/rides/:rideId/cancel", authMiddleware, cancelActiveRide);
router.put("/location", authMiddleware, updateDriverLocation);

module.exports = router;
