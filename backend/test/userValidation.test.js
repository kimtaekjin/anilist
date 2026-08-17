import test from "node:test";
import assert from "node:assert/strict";
import { normalizeEmail, validateEmail, validatePassword, validateUsername } from "../utils/userValidation.js";
import { validateEnvironment } from "../config/env.js";
import { needsKoreanTranslation } from "../utils/translationDetection.js";

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

test("translation detection handles English and mixed Japanese text", () => {
  assert.equal(needsKoreanTranslation("An English anime synopsis."), true);
  assert.equal(needsKoreanTranslation("설명: 日本語の文章"), true);
  assert.equal(needsKoreanTranslation("이미 번역된 한국어 설명입니다."), false);
  assert.equal(needsKoreanTranslation("한국어 설명 (TV)"), false);
});
