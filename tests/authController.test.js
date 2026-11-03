jest.mock("../db", () => ({
  query: jest.fn(),
  on: jest.fn(),
}));

const pool = require("../db");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { register, login, guestLogin } = require("../controllers/authController");

describe("Auth Controller", () => {
  let req;
  let res;
  const originalSecret = process.env.JWT_SECRET;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.JWT_SECRET = "test-jwt-secret-key-1234567890";

    req = {
      body: {},
    };

    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
  });

  afterAll(() => {
    process.env.JWT_SECRET = originalSecret;
  });

  describe("register", () => {
    test("successfully registers a new passenger with role 'rider'", async () => {
      req.body = {
        full_name: "Aarav Sharma",
        email: "aarav@example.com",
        phone: "+91 98765 11111",
        password: "securePassword123",
        role: "rider",
      };

      const mockUser = {
        id: "mock-rider-uuid",
        full_name: "Aarav Sharma",
        email: "aarav@example.com",
        phone: "+91 98765 11111",
        role: "rider",
        created_at: new Date().toISOString(),
      };

      pool.query.mockResolvedValueOnce({ rows: [mockUser] });

      await register(req, res);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: "Account created successfully.",
        user: mockUser,
      });

      // Verify password was hashed before DB insertion
      expect(pool.query).toHaveBeenCalledTimes(1);
      const insertedHash = pool.query.mock.calls[0][1][4];
      expect(insertedHash).not.toBe("securePassword123");
      const isMatch = await bcrypt.compare("securePassword123", insertedHash);
      expect(isMatch).toBe(true);
    });

    test("successfully registers a new passenger when role is sent as 'passenger' (normalized to 'rider')", async () => {
      req.body = {
        full_name: "Pooja Verma",
        email: "pooja@example.com",
        password: "password1234",
        role: "passenger",
      };

      const mockUser = {
        id: "mock-passenger-uuid",
        full_name: "Pooja Verma",
        email: "pooja@example.com",
        phone: null,
        role: "rider",
      };

      pool.query.mockResolvedValueOnce({ rows: [mockUser] });

      await register(req, res);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(pool.query.mock.calls[0][1][3]).toBe("rider");
    });

    test("successfully registers a new driver with role 'driver'", async () => {
      req.body = {
        full_name: "Rajesh Kumar",
        email: "driver.rajesh@example.com",
        phone: "+91 98220 99999",
        password: "driverPassword123",
        role: "driver",
      };

      const mockDriver = {
        id: "mock-driver-uuid",
        full_name: "Rajesh Kumar",
        email: "driver.rajesh@example.com",
        phone: "+91 98220 99999",
        role: "driver",
        created_at: new Date().toISOString(),
      };

      pool.query.mockResolvedValueOnce({ rows: [mockDriver] });

      await register(req, res);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: "Account created successfully.",
        user: mockDriver,
      });
      expect(pool.query.mock.calls[0][1][3]).toBe("driver");
    });

    test("returns 400 when required fields are missing", async () => {
      req.body = { email: "missing@example.com" };

      await register(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: "Full name, email, password, and role are required.",
        })
      );
      expect(pool.query).not.toHaveBeenCalled();
    });

    test("returns 400 for password with fewer than 8 characters", async () => {
      req.body = {
        full_name: "Short Pass",
        email: "short@example.com",
        password: "short",
        role: "rider",
      };

      await register(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: "Password must contain at least 8 characters.",
        })
      );
      expect(pool.query).not.toHaveBeenCalled();
    });

    test("returns 400 for invalid email format", async () => {
      req.body = {
        full_name: "Invalid Email",
        email: "not-an-email",
        password: "validPassword123",
        role: "rider",
      };

      await register(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: "Please provide a valid email address.",
        })
      );
    });

    test("returns 400 for invalid role", async () => {
      req.body = {
        full_name: "Admin User",
        email: "admin@example.com",
        password: "validPassword123",
        role: "admin",
      };

      await register(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: "Role must be rider or driver.",
        })
      );
    });

    test("returns 409 when email already exists (Postgres 23505 unique violation)", async () => {
      req.body = {
        full_name: "Duplicate User",
        email: "existing@example.com",
        password: "securePassword123",
        role: "rider",
      };

      const error = new Error("duplicate key value violates unique constraint");
      error.code = "23505";
      pool.query.mockRejectedValueOnce(error);

      await register(req, res);

      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: "An account with this email already exists.",
      });
    });

    test("returns 500 when database connection fails during registration", async () => {
      req.body = {
        full_name: "Test User",
        email: "dbfail@example.com",
        password: "securePassword123",
        role: "rider",
      };

      pool.query.mockRejectedValueOnce(new Error("connect ECONNREFUSED 127.0.0.1:5432"));

      await register(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: "Unable to register account. Please try again later.",
      });
    });
  });

  describe("login", () => {
    test("successfully logs in a passenger with valid credentials", async () => {
      const plainPassword = "passengerSecret123";
      const hashedPassword = await bcrypt.hash(plainPassword, 10);

      req.body = {
        email: "passenger@example.com",
        password: plainPassword,
      };

      const dbUser = {
        id: "passenger-uuid-1",
        full_name: "Rider Test",
        email: "passenger@example.com",
        phone: "+91 99999 88888",
        role: "rider",
        password_hash: hashedPassword,
      };

      pool.query.mockResolvedValueOnce({ rows: [dbUser] });

      await login(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      const jsonResponse = res.json.mock.calls[0][0];
      expect(jsonResponse.success).toBe(true);
      expect(jsonResponse.message).toBe("Login successful.");
      expect(jsonResponse.token).toBeDefined();
      expect(jsonResponse.user.email).toBe("passenger@example.com");
      expect(jsonResponse.user.role).toBe("rider");
      // Must not leak password hash
      expect(jsonResponse.user.password_hash).toBeUndefined();

      // Verify JWT decoded
      const decoded = jwt.verify(jsonResponse.token, process.env.JWT_SECRET);
      expect(decoded.sub).toBe("passenger-uuid-1");
      expect(decoded.role).toBe("rider");
    });

    test("successfully logs in a driver with valid credentials", async () => {
      const plainPassword = "driverSecret123";
      const hashedPassword = await bcrypt.hash(plainPassword, 10);

      req.body = {
        email: "driver@example.com",
        password: plainPassword,
      };

      const dbUser = {
        id: "driver-uuid-1",
        full_name: "Driver Suresh",
        email: "driver@example.com",
        phone: "+91 98220 12345",
        role: "driver",
        password_hash: hashedPassword,
      };

      pool.query.mockResolvedValueOnce({ rows: [dbUser] });

      await login(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      const jsonResponse = res.json.mock.calls[0][0];
      expect(jsonResponse.user.role).toBe("driver");
      const decoded = jwt.verify(jsonResponse.token, process.env.JWT_SECRET);
      expect(decoded.sub).toBe("driver-uuid-1");
      expect(decoded.role).toBe("driver");
    });

    test("returns 400 when email or password is missing", async () => {
      req.body = { email: "alone@example.com" };

      await login(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: "Email and password are required.",
        })
      );
      expect(pool.query).not.toHaveBeenCalled();
    });

    test("returns 401 when email is not found", async () => {
      req.body = {
        email: "unknown@example.com",
        password: "anyPassword123",
      };

      pool.query.mockResolvedValueOnce({ rows: [] });

      await login(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: "Invalid email or password.",
      });
    });

    test("returns 401 when password does not match", async () => {
      const correctHash = await bcrypt.hash("correctPassword123", 10);

      req.body = {
        email: "user@example.com",
        password: "WRONGpassword",
      };

      pool.query.mockResolvedValueOnce({
        rows: [
          {
            id: "user-uuid",
            email: "user@example.com",
            password_hash: correctHash,
            role: "rider",
          },
        ],
      });

      await login(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: "Invalid email or password.",
      });
    });

    test("returns 500 when JWT_SECRET is not configured", async () => {
      delete process.env.JWT_SECRET;

      const passwordHash = await bcrypt.hash("validPassword123", 10);
      req.body = {
        email: "valid@example.com",
        password: "validPassword123",
      };

      pool.query.mockResolvedValueOnce({
        rows: [
          {
            id: "u-1",
            email: "valid@example.com",
            password_hash: passwordHash,
            role: "rider",
          },
        ],
      });

      await login(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: "Authentication service is not configured.",
      });
    });

    test("returns 500 when database connection fails during login", async () => {
      req.body = {
        email: "user@example.com",
        password: "anyPassword123",
      };

      pool.query.mockRejectedValueOnce(new Error("Database connection timed out"));

      await login(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: "Authentication service temporarily unavailable. Please try again later.",
      });
    });
  });

  describe("guestLogin", () => {
    test("successfully logs in existing guest passenger", async () => {
      const guestUser = {
        id: "guest-uuid",
        full_name: "Guest Passenger",
        email: "guest.passenger@ridego.com",
        phone: "+91 98765 43210",
        role: "rider",
      };

      pool.query.mockResolvedValueOnce({ rows: [guestUser] });

      await guestLogin(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      const jsonResponse = res.json.mock.calls[0][0];
      expect(jsonResponse.success).toBe(true);
      expect(jsonResponse.user.role).toBe("rider");
      expect(jsonResponse.user.isGuest).toBe(true);
      expect(jsonResponse.token).toBeDefined();

      const decoded = jwt.verify(jsonResponse.token, process.env.JWT_SECRET);
      expect(decoded.sub).toBe("guest-uuid");
      expect(decoded.role).toBe("rider");
    });

    test("creates new guest user if not yet in database", async () => {
      const newGuest = {
        id: "new-guest-uuid",
        full_name: "Quick Guest",
        email: "guest.passenger@ridego.com",
        phone: "+91 99999 00000",
        role: "rider",
      };

      req.body = { name: "Quick Guest", phone: "+91 99999 00000" };

      // First query: select returns empty
      pool.query.mockResolvedValueOnce({ rows: [] });
      // Second query: insert returns new user
      pool.query.mockResolvedValueOnce({ rows: [newGuest] });

      await guestLogin(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(pool.query).toHaveBeenCalledTimes(2);
    });
  });
});

