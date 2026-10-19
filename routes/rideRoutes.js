
const express = require("express");
const authMiddleware = require("../middleware/authMiddleware");
const {
  requestRide,
  getMyRides,
} = require("../controllers/rideController");

const router = express.Router();

router.post("/", authMiddleware, requestRide);
router.get("/my-rides", authMiddleware, getMyRides);

module.exports = router;
