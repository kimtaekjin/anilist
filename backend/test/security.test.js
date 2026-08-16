import test from "node:test";
import assert from "node:assert/strict";
import { createRateLimiter } from "../middleware/security.js";

function createResponse() {
  const headers = new Map();
  return {
    statusCode: 200,
    body: null,
    setHeader(name, value) {
      headers.set(name.toLowerCase(), value);
    },
    getHeader(name) {
      return headers.get(name.toLowerCase());
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
}

test("rate limiter allows requests up to the configured limit", async () => {
  const limiter = createRateLimiter({ limit: 2, windowMs: 60_000, name: "test-allow" });
  const req = { ip: "192.0.2.1" };

  for (let count = 1; count <= 2; count += 1) {
    const res = createResponse();
    let calledNext = false;
    await limiter(req, res, () => {
      calledNext = true;
    });

    assert.equal(calledNext, true);
    assert.equal(res.getHeader("RateLimit-Remaining"), 2 - count);
  }
});

test("rate limiter blocks excess requests and includes Retry-After", async () => {
  const limiter = createRateLimiter({ limit: 1, windowMs: 60_000, name: "test-block" });
  const req = { ip: "192.0.2.2" };

  await limiter(req, createResponse(), () => {});

  const blockedResponse = createResponse();
  let calledNext = false;
  await limiter(req, blockedResponse, () => {
    calledNext = true;
  });

  assert.equal(calledNext, false);
  assert.equal(blockedResponse.statusCode, 429);
  assert.ok(blockedResponse.getHeader("Retry-After") >= 1);
  assert.match(blockedResponse.body.message, /요청이 너무 많습니다/);
});

test("rate limiter uses a shared store when it is available", async () => {
  let count = 0;
  const store = {
    isReady: true,
    async incr() {
      count += 1;
      return count;
    },
    async pExpire() {},
    async pTTL() {
      return 30_000;
    },
  };
  const limiter = createRateLimiter({ limit: 1, store, name: "test-shared" });
  const req = { ip: "192.0.2.3" };

  await limiter(req, createResponse(), () => {});
  const blockedResponse = createResponse();
  await limiter(req, blockedResponse, () => {});

  assert.equal(count, 2);
  assert.equal(blockedResponse.statusCode, 429);
});
