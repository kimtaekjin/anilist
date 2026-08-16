import test from "node:test";
import assert from "node:assert/strict";
import { normalizeEmail, validateEmail, validatePassword, validateUsername } from "../utils/userValidation.js";
import { validateEnvironment } from "../config/env.js";

test("email is normalized and validated", () => {
  assert.equal(normalizeEmail(" User@Example.COM "), "user@example.com");
  assert.equal(validateEmail("user@example.com"), true);
  assert.equal(validateEmail("invalid-email"), false);
});

test("username only accepts a safe 2-30 character identifier", () => {
  assert.equal(validateUsername("애니팬_01"), true);
  assert.equal(validateUsername("a"), false);
  assert.equal(validateUsername("name with space"), false);
});

test("password requires 8-72 characters with letters and digits", () => {
  assert.equal(validatePassword("anime123"), true);
  assert.equal(validatePassword("onlyletters"), false);
  assert.equal(validatePassword("12345678"), false);
});

test("environment validation rejects missing or weak secrets", () => {
  assert.throws(() => validateEnvironment({}), /Missing required/);
  assert.throws(
    () => validateEnvironment({ MONGO_URI: "mongodb://db", CLIENT_URL: "https://app.test", JWT_SECRET: "short" }),
    /at least 32/,
  );
  assert.doesNotThrow(() =>
    validateEnvironment({
      MONGO_URI: "mongodb://db",
      CLIENT_URL: "https://app.test",
      JWT_SECRET: "a".repeat(32),
    }),
  );
});
