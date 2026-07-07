import "dotenv/config";
import crypto from "crypto";
import fetch from "node-fetch";
import mongoose from "mongoose";
import redis from "../config/redis.js";
import Translation from "../models/Translate.js";

const DEEPL_AUTH_KEY = process.env.translationAPI;
const TRANSLATION_PROVIDER = "deepl";
const TRANSLATION_ENDPOINT =
  process.env.TRANSLATION_ENDPOINT ||
  (DEEPL_AUTH_KEY?.endsWith(":fx")
    ? "https://api-free.deepl.com/v2/translate"
    : "https://api.deepl.com/v2/translate");
const REQUEST_INTERVAL_MS = Number(process.env.TRANSLATION_REQUEST_INTERVAL_MS || 1500);
const DEFAULT_COOLDOWN_MS = 1000 * 60;
const REDIS_CACHE_TTL_SECONDS = Number(process.env.TRANSLATION_REDIS_TTL_SECONDS || 60 * 60 * 24 * 30);

let lastTranslationRequestAt = 0;
let translationCooldownUntil = 0;
let translationQueue = Promise.resolve();
let hasLoggedMissingKey = false;

const memoryCache = new Map();
const inflightTranslations = new Map();

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function getCacheKey(text, sourceLang, targetLang) {
  return `${sourceLang || "auto"}:${targetLang}:${text}`;
}

function getRedisCacheKey(text, sourceLang, targetLang) {
  const hash = crypto
    .createHash("sha256")
    .update(getCacheKey(text, sourceLang, targetLang))
    .digest("hex");

  return `translation:${TRANSLATION_PROVIDER}:${hash}`;
}

function getRetryAfterMs(response, errorBody) {
  const retryAfterHeader = Number(response.headers.get("retry-after"));
  if (Number.isFinite(retryAfterHeader) && retryAfterHeader > 0) {
    return retryAfterHeader * 1000;
  }

  try {
    const parsed = JSON.parse(errorBody);
    const retryAfterSeconds = parsed?.error?.retry_after_seconds || parsed?.retry_after_seconds;
    if (Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0) {
      return retryAfterSeconds * 1000;
    }
  } catch {
    // Ignore malformed error bodies.
  }

  return DEFAULT_COOLDOWN_MS;
}

function hasKorean(text) {
  return /[\uac00-\ud7a3]/.test(text);
}

function hasJapanese(text) {
  return /[\u3040-\u30ff\u3400-\u9fff]/.test(text);
}

function hasLatin(text) {
  return /[A-Za-z]/.test(text) && !hasKorean(text) && !hasJapanese(text);
}

function shouldIgnoreCachedTranslation(originalText, translatedText) {
  return translatedText === originalText && !hasKorean(originalText);
}

function getSourceLang(text) {
  if (hasJapanese(text)) return "ja";
  if (hasLatin(text)) return "en";
  return null;
}

async function waitForTranslationSlot() {
  const cooldownRemaining = translationCooldownUntil - Date.now();
  if (cooldownRemaining > 0) {
    const error = new Error(`Translation cooldown active for ${Math.ceil(cooldownRemaining / 1000)}s`);
    error.status = 429;
    throw error;
  }

  const elapsed = Date.now() - lastTranslationRequestAt;
  if (elapsed < REQUEST_INTERVAL_MS) {
    await sleep(REQUEST_INTERVAL_MS - elapsed);
  }

  lastTranslationRequestAt = Date.now();
}

function enqueueTranslation(task) {
  const run = translationQueue.then(task, task);
  translationQueue = run.catch(() => {});
  return run;
}

function normalizeDeepLSourceLang(source) {
  if (source === "ja") return "JA";
  if (source === "en") return "EN";
  return null;
}

function normalizeDeepLTargetLang(target) {
  if (target === "ko") return "KO";
  if (target === "ja") return "JA";
  if (target === "en") return "EN-US";
  return target.toUpperCase();
}

function buildDeepLRequestBody(text, source, target) {
  const body = {
    text: [text],
    target_lang: normalizeDeepLTargetLang(target),
  };

  const sourceLang = normalizeDeepLSourceLang(source);
  if (sourceLang) {
    body.source_lang = sourceLang;
  }

  return body;
}

function parseDeepLResponse(data, fallbackText) {
  return data?.translations?.[0]?.text || fallbackText;
}

export async function translate(text, source, target) {
  if (!DEEPL_AUTH_KEY) {
    if (!hasLoggedMissingKey) {
      console.warn("translationAPI is not configured. Returning untranslated text.");
      hasLoggedMissingKey = true;
    }
    return text;
  }

  return enqueueTranslation(async () => {
    await waitForTranslationSlot();

    const response = await fetch(TRANSLATION_ENDPOINT, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `DeepL-Auth-Key ${DEEPL_AUTH_KEY}`,
      },
      body: JSON.stringify(buildDeepLRequestBody(text, source, target)),
    });

    if (!response.ok) {
      const errorBody = await response.text();

      if (response.status === 429 || response.status === 456) {
        translationCooldownUntil = Date.now() + getRetryAfterMs(response, errorBody);
      }

      const error = new Error(`Translation API error ${response.status} ${response.statusText}: ${errorBody}`);
      error.status = response.status;
      error.body = errorBody;
      throw error;
    }

    const data = await response.json();
    return parseDeepLResponse(data, text);
  });
}

export function replaceMistranslation(translatedText) {
  if (!translatedText) return "";

  return translatedText
    .trim()
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, "\"")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

async function findCachedTranslation(originalText, sourceLang, targetLang) {
  const cacheKey = getCacheKey(originalText, sourceLang, targetLang);

  if (memoryCache.has(cacheKey)) {
    return memoryCache.get(cacheKey);
  }

  const redisCacheKey = getRedisCacheKey(originalText, sourceLang, targetLang);
  if (redis.isOpen) {
    try {
      const cached = await redis.get(redisCacheKey);
      if (cached && !shouldIgnoreCachedTranslation(originalText, cached)) {
        memoryCache.set(cacheKey, cached);
        return cached;
      }
    } catch (error) {
      console.error("Translation Redis cache lookup failed:", error.message);
    }
  }

  if (mongoose.connection.readyState !== 1) {
    return null;
  }

  try {
    const cached = await Translation.findOne({
      provider: TRANSLATION_PROVIDER,
      originalText,
      sourceLang: sourceLang || "auto",
      targetLang,
    }).lean();
    if (cached?.translatedText) {
      if (shouldIgnoreCachedTranslation(originalText, cached.translatedText)) {
        return null;
      }

      memoryCache.set(cacheKey, cached.translatedText);
      if (redis.isOpen) {
        await redis.setEx(redisCacheKey, REDIS_CACHE_TTL_SECONDS, cached.translatedText).catch((error) => {
          console.error("Translation Redis cache save failed:", error.message);
        });
      }
      return cached.translatedText;
    }
  } catch (error) {
    console.error("Translation cache lookup failed:", error.message);
  }

  return null;
}

async function saveCachedTranslation(originalText, sourceLang, targetLang, translatedText) {
  if (shouldIgnoreCachedTranslation(originalText, translatedText)) {
    return;
  }

  const cacheKey = getCacheKey(originalText, sourceLang, targetLang);
  memoryCache.set(cacheKey, translatedText);

  if (redis.isOpen) {
    const redisCacheKey = getRedisCacheKey(originalText, sourceLang, targetLang);
    await redis.setEx(redisCacheKey, REDIS_CACHE_TTL_SECONDS, translatedText).catch((error) => {
      console.error("Translation Redis cache save failed:", error.message);
    });
  }

  if (mongoose.connection.readyState !== 1) {
    return;
  }

  try {
    await Translation.updateOne(
      {
        provider: TRANSLATION_PROVIDER,
        originalText,
        sourceLang: sourceLang || "auto",
        targetLang,
      },
      { $set: { translatedText } },
      { upsert: true },
    );
  } catch (error) {
    console.error("Translation cache save failed:", error.message);
  }
}

async function translateWithCache(originalText, sourceLang, targetLang) {
  const cached = await findCachedTranslation(originalText, sourceLang, targetLang);
  if (cached) return cached;

  const cacheKey = getCacheKey(originalText, sourceLang, targetLang);
  if (inflightTranslations.has(cacheKey)) {
    return inflightTranslations.get(cacheKey);
  }

  const translationPromise = translate(originalText, sourceLang, targetLang)
    .then((translatedText) => replaceMistranslation(translatedText))
    .then(async (translatedText) => {
      await saveCachedTranslation(originalText, sourceLang, targetLang, translatedText);
      return translatedText;
    })
    .finally(() => {
      inflightTranslations.delete(cacheKey);
    });

  inflightTranslations.set(cacheKey, translationPromise);
  return translationPromise;
}

export async function traslateItem(text) {
  if (!text || typeof text !== "string") return "";

  const targetLang = "ko";
  const originalText = text.trim();
  if (!originalText || hasKorean(originalText)) return originalText;

  try {
    return await translateWithCache(originalText, getSourceLang(originalText), targetLang);
  } catch (error) {
    if (error.status !== 429 && error.status !== 456) {
      console.error("Translation failed:", error.message);
    }

    return text;
  }
}

export const translateItem = traslateItem;
