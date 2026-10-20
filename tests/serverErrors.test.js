
jest.mock("../db", () => ({
  query: jest.fn(),
}));

const request = require("supertest");
const app = require("../server");

describe("API request error handling", () => {
  test("returns JSON 400 for malformed JSON", async () => {
    const response = await request(app)
      .post("/api/auth/login")
      .set("Content-Type", "application/json")
      .send("{bad json");

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      success: false,
      message: "Invalid JSON request body.",
    });
  });

  test("returns JSON 413 for oversized JSON", async () => {
    const response = await request(app)
      .post("/api/auth/login")
      .set("Content-Type", "application/json")
      .send(JSON.stringify({ data: "x".repeat(110 * 1024) }));

    expect(response.status).toBe(413);
    expect(response.body).toEqual({
      success: false,
      message: "Request body is too large.",
    });
  });
});
