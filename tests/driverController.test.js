
jest.mock("../db", () => ({
  query: jest.fn(),
}));

const pool = require("../db");
const {
  getAvailableRides,
  acceptRide,
  updateRideStatus,
} = require("../controllers/driverController");

describe("Driver controller", () => {
  let req;
  let res;

  beforeEach(() => {
    jest.clearAllMocks();

    req = {
      user: { id: "test-driver-id", role: "driver" },
      params: { rideId: "d4f6d2c8-ae41-4a4d-9079-9302aad2e98b" },
      body: {},
    };

    res = {
      status: jest.fn(),
      json: jest.fn(),
    };

    res.status.mockReturnValue(res);
    res.json.mockReturnValue(res);
  });

  test("rejects riders from available rides", async () => {
    req.user.role = "rider";

    await getAvailableRides(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(pool.query).not.toHaveBeenCalled();
  });

  test("returns available rides for drivers", async () => {
    const rides = [{ id: req.params.rideId, status: "requested" }];
    pool.query.mockResolvedValueOnce({ rows: rides });

    await getAvailableRides(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      count: 1,
      rides,
    });
  });

  test("rejects riders attempting to accept rides", async () => {
    req.user.role = "rider";

    await acceptRide(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(pool.query).not.toHaveBeenCalled();
  });

  test("rejects malformed ride IDs", async () => {
    req.params.rideId = "not-a-uuid";

    await acceptRide(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(pool.query).not.toHaveBeenCalled();
  });

  test("accepts a ride when the database update succeeds", async () => {
    const ride = {
      id: req.params.rideId,
      driver_id: req.user.id,
      status: "accepted",
    };

    pool.query.mockResolvedValueOnce({ rows: [ride] });

    await acceptRide(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      message: "Ride accepted successfully.",
      ride,
    });
  });

  test("rejects invalid next ride statuses", async () => {
    req.body.status = "teleported";

    await updateRideStatus(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(pool.query).not.toHaveBeenCalled();
  });

  test("allows a valid status transition", async () => {
    req.body.status = "arriving";

    const ride = {
      id: req.params.rideId,
      driver_id: req.user.id,
      status: "arriving",
    };

    pool.query.mockResolvedValueOnce({ rows: [ride] });

    await updateRideStatus(req, res);

    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining("AND status = $4"),
      ["arriving", req.params.rideId, req.user.id, "accepted"]
    );

    expect(res.status).toHaveBeenCalledWith(200);
  });

  test("rejects a transition when the ride is not in the expected state", async () => {
    req.body.status = "arriving";
    pool.query.mockResolvedValueOnce({ rows: [] });

    await updateRideStatus(req, res);

    expect(res.status).toHaveBeenCalledWith(409);
  });

  test("returns cancelled indicator if passenger cancelled the ride", async () => {
    req.body.status = "arriving";
    pool.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ status: "cancelled" }] });

    await updateRideStatus(req, res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        cancelled: true,
        message: expect.stringContaining("cancelled"),
      })
    );
  });
});
