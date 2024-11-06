const request = require("supertest"); 
const app = require("../app"); 
const mongoose = require("mongoose"); 

// Test suite for core functionality
describe("Core app functionality", () => {
    
    // Test /pingServer route
    it("should respond with 'OK' on /pingServer", async () => {
        const res = await request(app).get("/api/pingServer");
        expect(res.statusCode).toBe(200);
        expect(res.text).toBe("OK");
    });

    // Test 404 error for non-existent routes
    it("should return 404 for non-existent routes", async () => {
        const res = await request(app).get("/non-existent-route");
        expect(res.statusCode).toBe(404);
        expect(res.body).toHaveProperty("result", "error");
    });

    // Test validation errors on /register/email
    it("should handle validation errors gracefully on /register/email", async () => {
        const res = await request(app)
            .post("/api/user/register/email")
            .send({ invalidField: "test" });
        console.log("Validation response body:", res.body);
        expect(res.statusCode).toBe(422);
        expect(res.body).toHaveProperty("result", "Validation error");
    });

    // Close MongoDB connection after tests
    afterAll(async () => {
        await mongoose.connection.close();
    });
});
