import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert";
import express from "express";
import { createServer, type Server } from "node:http";
import authRouter from "./auth";
import {
  issueRefreshToken,
  clearTokenStoreForTesting,
} from "../lib/refreshTokenRotation";

describe("Token Lifecycle, Silent Refresh, and Compromise Protection Engine", () => {
  let server: Server;
  let baseUrl: string;

  before(async () => {
    const app = express();
    app.use(express.json());
    app.use(authRouter);

    await new Promise<void>((resolve) => {
      server = createServer(app).listen(0, "127.0.0.1", () => {
        const addr = server.address() as { port: number };
        baseUrl = `http://127.0.0.1:${addr.port}`;
        resolve();
      });
    });
  });

  after(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  beforeEach(() => {
    clearTokenStoreForTesting();
  });

  it("Step 1 (Silent Refresh & Rotation): POST /auth/refresh rotates token and extends session invisibly", async () => {
    const initialToken = issueRefreshToken("user_8820");

    const res = await fetch(`${baseUrl}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken: initialToken.token }),
    });

    assert.strictEqual(res.status, 200);
    const body = (await res.json()) as any;

    assert.strictEqual(body.ok, true);
    assert.strictEqual(body.refreshed, true);
    assert.ok(body.refreshToken);
    assert.notStrictEqual(body.refreshToken, initialToken.token); // Rotated!
  });

  it("Step 2 (Graceful Refresh Failure): returns 401 with preserveState=true on expired or invalid token", async () => {
    const res = await fetch(`${baseUrl}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken: "rft_invalid_token_999" }),
    });

    assert.strictEqual(res.status, 401);
    const body = (await res.json()) as any;

    assert.strictEqual(body.code, "session_expired");
    assert.strictEqual(body.preserveState, true);
    assert.strictEqual(body.redirect, "/login");
  });

  it("Step 3 (Replay Compromise Detection): presenting an already-used refresh token revokes token family immediately", async () => {
    const firstToken = issueRefreshToken("user_9950");

    // 1st Refresh: succeeds & consumes firstToken
    const res1 = await fetch(`${baseUrl}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken: firstToken.token }),
    });
    assert.strictEqual(res1.status, 200);
    const body1 = (await res1.json()) as any;
    const secondToken = body1.refreshToken;

    // 2nd Refresh attempt using ALREADY-USED firstToken (Theft / Replay Attack)
    const resReplay = await fetch(`${baseUrl}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken: firstToken.token }),
    });

    assert.strictEqual(resReplay.status, 401);
    const bodyReplay = (await resReplay.json()) as any;

    assert.strictEqual(bodyReplay.code, "token_reuse_compromise");
    assert.strictEqual(bodyReplay.action, "revoke_all_sessions");

    // Attempting to use even the second valid token now fails because family was revoked!
    const resFamilyRevoked = await fetch(`${baseUrl}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken: secondToken }),
    });

    assert.strictEqual(resFamilyRevoked.status, 401);
  });
});
