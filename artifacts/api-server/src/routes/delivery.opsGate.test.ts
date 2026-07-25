import assert from "node:assert/strict";
import { test } from "node:test";
import express, { type Request, type Response, type NextFunction } from "express";
import http from "node:http";
import { type AddressInfo } from "node:net";
import router from "./delivery"; // Assuming default export or import as needed

// Mock dependencies if needed, or use real ones if DB is running
// For this test, we mostly want to verify the GATE behaviour (403 vs 200/400)

const app = express();
app.use(express.json());

// Auth stub
let mockUser: { id: string } | null = null;
let mockIsAuthenticated = false;

app.use((req: any, res: Response, next: NextFunction) => {
  req.isAuthenticated = () => mockIsAuthenticated;
  if (mockUser) {
    req.user = mockUser;
  }
  req.log = { error: () => {}, info: () => {}, warn: () => {} };
  next();
});

app.use(router);

test("Delivery Ops Gate", async (t) => {
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const port = (server.address() as AddressInfo).port;
  const baseUrl = `http://127.0.0.1:${port}`;

  const fetchRoute = async (path: string, options: RequestInit = {}) => {
    return fetch(`${baseUrl}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      ...options,
    });
  };

  await t.test("POST /delivery/events requires ops scope", async () => {
    mockIsAuthenticated = true;
    mockUser = { id: "regular-user" };
    // Clear ops env vars just in case
    process.env.OPS_USER_IDS = "";
    process.env.RD_ADMIN_TOKEN = "secret";

    const res = await fetchRoute("/delivery/events", {
      body: JSON.stringify({ orderId: 1, event: "test" }),
    });
    assert.equal(res.status, 403);
    const body = (await res.json()) as any;
    assert.equal(body.error, "ops scope required");
  });

  await t.test("POST /delivery/events passes with admin token", async () => {
    process.env.RD_ADMIN_TOKEN = "secret";
    const res = await fetchRoute("/delivery/events", {
      headers: {
        "Content-Type": "application/json",
        "x-admin-token": "secret",
      },
      body: JSON.stringify({ orderId: 1, event: "test" }),
    });
    // It might fail validation (400) or DB (500) but shouldn't be 403/401
    assert.notEqual(res.status, 403);
    assert.notEqual(res.status, 401);
  });

  await t.test("POST /delivery/events passes with ops user id", async () => {
    mockIsAuthenticated = true;
    mockUser = { id: "ops-user" };
    process.env.OPS_USER_IDS = "ops-user,other-user";

    const res = await fetchRoute("/delivery/events", {
      body: JSON.stringify({ orderId: 1, event: "test" }),
    });
    assert.notEqual(res.status, 403);
    assert.notEqual(res.status, 401);
  });

  // Repeat for other gated routes if needed, or assume coverage by pattern
  
  server.close();
});
