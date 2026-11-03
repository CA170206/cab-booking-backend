const express = require("express");
const { register, login, guestLogin } = require("../controllers/authController");
const { getProfile } = require("../controllers/profileController");
const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();

router.post("/register", register);
router.post("/login", login);
router.post("/guest", guestLogin);
router.get("/me", authMiddleware, getProfile);

module.exports = router;
