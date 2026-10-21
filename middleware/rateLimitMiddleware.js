
const rateLimit = require("express-rate-limit");

const isTest = process.env.NODE_ENV === "test";
const defaultLimit = isTest ? 10 : 100;
const limit = process.env.AUTH_RATE_LIMIT
  ? parseInt(process.env.AUTH_RATE_LIMIT, 10)
  : defaultLimit;

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: {
    success: false,
    message: "Too many authentication attempts. Please try again later.",
  },
});

module.exports = { authLimiter };
