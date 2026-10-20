
jest.mock("express-rate-limit", () => {
  return jest.fn(() => ({
    __testLimiter: true,
  }));
});

const rateLimit = require("express-rate-limit");
const { authLimiter } = require("../middleware/rateLimitMiddleware");

describe("Authentication rate limiter configuration", () => {
  test("configures a 15-minute window and a limit of 10 requests", () => {
    expect(rateLimit).toHaveBeenCalledWith(
      expect.objectContaining({
        windowMs: 15 * 60 * 1000,
        limit: 10,
        standardHeaders: true,
        legacyHeaders: false,
        message: {
          success: false,
          message: "Too many authentication attempts. Please try again later.",
        },
      })
    );
  });

  test("exports the configured authentication limiter", () => {
    expect(authLimiter).toEqual({ __testLimiter: true });
  });
});
