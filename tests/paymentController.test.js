const crypto = require("crypto");

jest.mock("../db", () => ({
  query: jest.fn(),
}));

const pool = require("../db");
const {
  createOrder,
  verifyPayment,
  getPaymentStatus,
} = require("../controllers/paymentController");

describe("Payment controller", () => {
  let req;
  let res;
  const mockRideId = "12345678-1234-1234-1234-123456789abc";
  const mockRiderId = "87654321-4321-4321-4321-cba987654321";

  beforeEach(() => {
    jest.clearAllMocks();

    req = {
      user: { id: mockRiderId, role: "rider" },
      body: {},
      params: {},
    };

    res = {
      status: jest.fn(),
      json: jest.fn(),
    };

    res.status.mockReturnValue(res);
    res.json.mockReturnValue(res);
  });

  describe("createOrder", () => {
    test("rejects non-rider roles", async () => {
      req.user.role = "driver";
      await createOrder(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: "Only authenticated riders can initiate payments.",
        })
      );
    });

    test("rejects invalid ride_id format", async () => {
      req.body.ride_id = "not-a-valid-uuid";
      await createOrder(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: "A valid ride_id is required.",
        })
      );
    });

    test("rejects when ride is not found", async () => {
      req.body.ride_id = mockRideId;
      pool.query.mockResolvedValueOnce({ rows: [] });

      await createOrder(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: "Ride not found.",
        })
      );
    });

    test("rejects when rider does not own the ride", async () => {
      req.body.ride_id = mockRideId;
      pool.query.mockResolvedValueOnce({
        rows: [
          {
            id: mockRideId,
            rider_id: "other-rider-uuid",
            estimated_fare: "150.00",
          },
        ],
      });

      await createOrder(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: "You can only make payments for your own rides.",
        })
      );
    });

    test("rejects if ride has already been paid for", async () => {
      req.body.ride_id = mockRideId;
      // Ride lookup
      pool.query.mockResolvedValueOnce({
        rows: [
          {
            id: mockRideId,
            rider_id: mockRiderId,
            estimated_fare: "150.00",
          },
        ],
      });
      // Existing payment lookup
      pool.query.mockResolvedValueOnce({
        rows: [
          {
            id: "payment-123",
            ride_id: mockRideId,
            status: "paid",
          },
        ],
      });

      await createOrder(req, res);

      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: "This ride has already been paid for.",
        })
      );
    });

    test("creates a new payment order when valid", async () => {
      req.body.ride_id = mockRideId;
      // Ride lookup
      pool.query.mockResolvedValueOnce({
        rows: [
          {
            id: mockRideId,
            rider_id: mockRiderId,
            estimated_fare: "220.00",
            pickup_address: "A",
            dropoff_address: "B",
          },
        ],
      });
      // Existing payment lookup (none)
      pool.query.mockResolvedValueOnce({ rows: [] });
      // Insert payment record
      pool.query.mockResolvedValueOnce({
        rows: [
          {
            id: "payment-new-uuid",
            ride_id: mockRideId,
            amount: 220.0,
            status: "created",
          },
        ],
      });

      await createOrder(req, res);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          order: expect.objectContaining({
            amount: 220,
            amount_in_paise: 22000,
            currency: "INR",
          }),
        })
      );
    });
  });

  describe("verifyPayment", () => {
    test("rejects missing parameters", async () => {
      req.body = { ride_id: mockRideId };
      await verifyPayment(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: expect.stringContaining("gateway_order_id"),
        })
      );
    });

    test("rejects when payment order record is not found", async () => {
      req.body = {
        ride_id: mockRideId,
        gateway_order_id: "order_123",
        gateway_payment_id: "pay_123",
      };
      pool.query.mockResolvedValueOnce({ rows: [] });

      await verifyPayment(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: "Payment order record not found.",
        })
      );
    });

    test("handles idempotent verification if already paid", async () => {
      req.body = {
        ride_id: mockRideId,
        gateway_order_id: "order_123",
        gateway_payment_id: "pay_123",
      };
      pool.query.mockResolvedValueOnce({
        rows: [
          {
            id: "payment-123",
            ride_id: mockRideId,
            rider_id: mockRiderId,
            status: "paid",
          },
        ],
      });

      await verifyPayment(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: "Payment has already been verified and recorded.",
        })
      );
    });

    test("successfully verifies valid simulated or test payment", async () => {
      req.body = {
        ride_id: mockRideId,
        gateway_order_id: "order_sim_123",
        gateway_payment_id: "pay_sim_456",
      };
      pool.query.mockResolvedValueOnce({
        rows: [
          {
            id: "payment-123",
            ride_id: mockRideId,
            rider_id: mockRiderId,
            status: "created",
          },
        ],
      });
      // Update DB to paid
      pool.query.mockResolvedValueOnce({
        rows: [
          {
            id: "payment-123",
            status: "paid",
            gateway_payment_id: "pay_sim_456",
          },
        ],
      });

      await verifyPayment(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: "Payment verified successfully.",
        })
      );
    });
  });

  describe("getPaymentStatus", () => {
    test("rejects invalid identifier format", async () => {
      req.params = { identifier: "invalid-id" };
      await getPaymentStatus(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: "A valid UUID identifier is required.",
        })
      );
    });

    test("returns 404 when payment record not found", async () => {
      req.params = { identifier: mockRideId };
      pool.query.mockResolvedValueOnce({ rows: [] });

      await getPaymentStatus(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: "Payment record not found.",
        })
      );
    });

    test("returns payment record if found and authorized", async () => {
      req.params = { identifier: mockRideId };
      pool.query.mockResolvedValueOnce({
        rows: [
          {
            id: "payment-uuid",
            ride_id: mockRideId,
            rider_id: mockRiderId,
            amount: "180.00",
            status: "paid",
          },
        ],
      });

      await getPaymentStatus(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          payment: expect.objectContaining({
            status: "paid",
          }),
        })
      );
    });
  });
});
