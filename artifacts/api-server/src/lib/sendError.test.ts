import test from "node:test";
import assert from "node:assert/strict";
import type { Request, Response } from "express";
import { sendError } from "./sendError";

function fakeRes(): Response & { statusCode?: number; body?: unknown } {
  const res = {} as Response & { statusCode?: number; body?: unknown };
  res.status = ((code: number) => {
    res.statusCode = code;
    return res;
  }) as Response["status"];
  res.json = ((body: unknown) => {
    res.body = body;
    return res;
  }) as Response["json"];
  return res;
}

function fakeReq(withLog: boolean): Request {
  const req = {} as Request;
  if (withLog) {
    req.log = {
      error: () => {},
    } as unknown as Request["log"];
  }
  return req;
}

test("defaults to 500 and withholds err.message from the client", () => {
  const res = fakeRes();
  sendError(fakeReq(true), res, new Error("column users.secret_col does not exist"));
  assert.equal(res.statusCode, 500);
  assert.deepEqual(res.body, { error: "internal error" });
});

test("opts.status + opts.expose override the default for a caller-facing error", () => {
  const res = fakeRes();
  sendError(fakeReq(true), res, new Error("order not found"), {
    status: 404,
    expose: "order not found",
  });
  assert.equal(res.statusCode, 404);
  assert.deepEqual(res.body, { error: "order not found" });
});

test("a 5xx with no explicit expose still gets the generic message, not err.message", () => {
  const res = fakeRes();
  sendError(fakeReq(true), res, new Error("statement timeout"), { status: 504 });
  assert.equal(res.statusCode, 504);
  assert.deepEqual(res.body, { error: "internal error" });
});

test("logs via req.log.error when it is present", () => {
  const res = fakeRes();
  const calls: unknown[] = [];
  const req = fakeReq(false);
  req.log = { error: (...args: unknown[]) => calls.push(args) } as unknown as Request["log"];
  sendError(req, res, new Error("boom"), { event: "probe.test" });
  assert.equal(calls.length, 1);
});

test("does not throw when req.log is absent (bare test-harness apps)", () => {
  const res = fakeRes();
  assert.doesNotThrow(() => {
    sendError(fakeReq(false), res, new Error("boom"));
  });
  assert.equal(res.statusCode, 500);
});
