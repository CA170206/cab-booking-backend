
const jwt = require("jsonwebtoken");
const authMiddleware = require("../middleware/authMiddleware");

describe("Authentication middleware", () => {
  const originalSecret = process.env.JWT_SECRET;

  beforeAll(() => {
    process.env.JWT_SECRET = "test-only-secret-for-unit-tests";
  });

  afterAll(() => {
    if (originalSecret === undefined) {
      delete process.env.JWT_SECRET;
    } else {
      process.env.JWT_SECRET = originalSecret;
    }
  });

  const makeResponse = () => {
    const res = {
      status: jest.fn(),
      json: jest.fn(),
    };

    res.status.mockReturnValue(res);
    res.json.mockReturnValue(res);

    return res;
  };

  test("rejects a request without a token", () => {
    const req = { headers: {} };
    const res = makeResponse();
    const next = jest.fn();

    authMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: "Authentication token is required.",
    });
    expect(next).not.toHaveBeenCalled();
  });

  test("accepts a valid token and attaches the user", () => {
    const token = jwt.sign(
      { role: "driver" },
      process.env.JWT_SECRET,
      {
        subject: "test-driver-id",
        expiresIn: "5m",
      }
    );

    const req = {
      headers: { authorization: `Bearer ${token}` },
    };
    const res = makeResponse();
    const next = jest.fn();

    authMiddleware(req, res, next);

    expect(req.user).toEqual({
      id: "test-driver-id",
      role: "driver",
    });
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  test("rejects an invalid token", () => {
    const req = {
      headers: { authorization: "Bearer invalid-token" },
    };
    const res = makeResponse();
    const next = jest.fn();

    authMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: "Invalid or expired authentication token.",
    });
    expect(next).not.toHaveBeenCalled();
  });
});
