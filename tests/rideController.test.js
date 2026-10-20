
jest.mock("../db", () => ({
  query: jest.fn(),
}));

const pool = require("../db");
const {
  requestRide,
  getMyRides,
} = require("../controllers/rideController");

describe("Ride controller", () => {
  let req;
  let res;

  beforeEach(() => {
    jest.clearAllMocks();

    req = {
      user: { id: "test-rider-id", role: "rider" },
      body: {},
    };

    res = {
      status: jest.fn(),
      json: jest.fn(),
    };

    res.status.mockReturnValue(res);
    res.json.mockReturnValue(res);
  });

  test("rejects a driver attempting to request a ride", async () => {
    req.user.role = "driver";

    await requestRide(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: "Only riders can request rides.",
    });
    expect(pool.query).not.toHaveBeenCalled();
  });

  test("rejects a ride request with missing addresses", async () => {
    await requestRide(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        message: expect.stringContaining("pickup and drop-off addresses"),
      })
    );
    expect(pool.query).not.toHaveBeenCalled();
  });

  test("rejects a ride request with invalid coordinates", async () => {
    req.body = {
      pickup_address: "Sandip University, Nashik",
      dropoff_address: "Nashik Road Station",
      pickup_lat: 200,
      pickup_lng: 73.83,
      dropoff_lat: 19.99,
      dropoff_lng: 73.79,
    };

    await requestRide(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(pool.query).not.toHaveBeenCalled();
  });

  test("rejects a driver attempting to view rider history", async () => {
    req.user.role = "driver";

    await getMyRides(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: "This endpoint is for riders only.",
    });
    expect(pool.query).not.toHaveBeenCalled();
  });

  test("returns ride history for the authenticated rider", async () => {
    const rides = [
      { id: "test-ride-id", status: "completed" },
    ];

    pool.query.mockResolvedValueOnce({ rows: rides });

    await getMyRides(req, res);

    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining("WHERE rider_id = $1"),
      ["test-rider-id"]
    );

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      count: 1,
      rides,
    });
  });
});
