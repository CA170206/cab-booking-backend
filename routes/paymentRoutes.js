const express = require("express");
const authMiddleware = require("../middleware/authMiddleware");
const {
  createOrder,
  verifyPayment,
  getPaymentStatus,
  confirmQrPayment,
} = require("../controllers/paymentController");

const router = express.Router();

router.post("/create-order", authMiddleware, createOrder);
router.post("/verify", authMiddleware, verifyPayment);
router.post("/confirm-qr", authMiddleware, confirmQrPayment);
router.get("/status/:identifier", authMiddleware, getPaymentStatus);
router.get("/ride/:identifier", authMiddleware, getPaymentStatus);

module.exports = router;
