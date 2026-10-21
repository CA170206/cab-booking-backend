
const express = require("express");
const authMiddleware = require("../middleware/authMiddleware");
const {
  requestRide,
  getMyRides,
  getRideDetails,
  resendOtp,
  rateRide,
  cancelRide,
  getPublicReviewsAndStats,
} = require("../controllers/rideController");

const router = express.Router();

// Public platform reviews & stats
router.get("/public/reviews", getPublicReviewsAndStats);

router.post("/", authMiddleware, requestRide);
router.get("/my-rides", authMiddleware, getMyRides);
router.get("/:rideId", authMiddleware, getRideDetails);
router.post("/:rideId/resend-otp", authMiddleware, resendOtp);
router.post("/:rideId/rate", authMiddleware, rateRide);
router.post("/:rideId/cancel", authMiddleware, cancelRide);

module.exports = router;

