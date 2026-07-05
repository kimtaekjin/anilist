import "dotenv/config";
import fetch from "node-fetch";
import wanakana from "wanakana";
import Translation from "../models/Translate.js";
import { wordReplacements, replacements } from "./wordReplace.js";

const GOOGLE_KEY = process.env.GOOGLETRANSLATION;
const TRANSLATION_ENDPOINT = "https://api.langbly.com/language/translate/v2";
const REQUEST_INTERVAL_MS = Number(process.env.TRANSLATION_REQUEST_INTERVAL_MS || 1500);
const DEFAULT_COOLDOWN_MS = 1000 * 60;

let lastTranslationRequestAt = 0;
let translationCooldownUntil = 0;

const memoryCache = new Map();
const inflightTranslations = new Map();

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function getCacheKey(text, sourceLang, targetLang) {
  return `${sourceLang}:${targetLang}:${text}`;
}

function getRetryAfterMs(response, errorBody) {
  const retryAfterHeader = Number(response.headers.get("retry-after"));
  if (Number.isFinite(retryAfterHeader) && retryAfterHeader > 0) {
    return retryAfterHeader * 1000;
  }

  try {
    const parsed = JSON.parse(errorBody);
    const retryAfterSeconds = parsed?.error?.retry_after_seconds;
    if (Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0) {
      return retryAfterSeconds * 1000;
    }
  } catch {
    // Ignore malformed error bodies.
  }

  return DEFAULT_COOLDOWN_MS;
}

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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

export function romajiToKatakana(text) {
  if (!text) return "";

  let converted = text.toLowerCase();

  for (const [pattern, repl] of replacements) {
    converted = converted.replace(new RegExp(pattern, "g"), repl);
  }

  converted = converted.replace(/(\d+)(st|nd|rd|th)/gi, (_, num) => `${num} セカンド`);

  return converted.replace(/[a-zA-Z]+/g, (match) => wanakana.toKatakana(match.toLowerCase()));
}

export async function translate(text, source, target) {
  if (!GOOGLE_KEY) {
    return text;
  }

  await waitForTranslationSlot();

  const bodyPayload = {
    q: text,
    target,
  };

  if (source && source !== "auto") {
    bodyPayload.source = source;
  }

  const response = await fetch(TRANSLATION_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": GOOGLE_KEY,
    },
    body: JSON.stringify(bodyPayload),
  });

  if (!response.ok) {
    const errorBody = await response.text();

    if (response.status === 429) {
      translationCooldownUntil = Date.now() + getRetryAfterMs(response, errorBody);
    }

    const error = new Error(`Translation API error ${response.status}: ${errorBody}`);
    error.status = response.status;
    error.body = errorBody;
    throw error;
  }

  const data = await response.json();
  return data.data?.translations?.[0]?.translatedText || text;
}

export function isRomaji(text) {
  if (!text) return false;
  if (!/^[A-Za-z\s]+$/.test(text)) return false;

  const words = text.trim().split(/\s+/);
  if (words.length < 2 || words.length > 3) return false;
  if (!words.every((word) => /^[A-Z][a-z]+$/.test(word))) return false;

  const englishBlacklist = ["The", "Of", "And"];
  return !words.some((word) => englishBlacklist.includes(word));
}

export function replaceMistranslation(translatedText) {
  if (!translatedText) return "";

  let fixed = translatedText.trim();

  for (const { from, to } of wordReplacements) {
    const patterns = Array.isArray(from) ? from : [from];

    for (const pattern of patterns) {
      fixed = fixed.replace(new RegExp(escapeRegExp(String(pattern)), "gi"), to);
    }
  }

  return fixed;
}

async function findCachedTranslation(originalText, sourceLang, targetLang) {
  const cacheKey = getCacheKey(originalText, sourceLang, targetLang);

  if (memoryCache.has(cacheKey)) {
    return memoryCache.get(cacheKey);
  }

  try {
    const cached = await Translation.findOne({ originalText, sourceLang, targetLang }).lean();
    if (cached?.translatedText) {
      memoryCache.set(cacheKey, cached.translatedText);
      return cached.translatedText;
    }
  } catch (error) {
    console.error("Translation cache lookup failed:", error.message);
  }

  return null;
}

async function saveCachedTranslation(originalText, sourceLang, targetLang, translatedText) {
  const cacheKey = getCacheKey(originalText, sourceLang, targetLang);
  memoryCache.set(cacheKey, translatedText);

  try {
    await Translation.updateOne(
      { originalText, sourceLang, targetLang },
      { $set: { translatedText } },
      { upsert: true },
    );
  } catch (error) {
    console.error("Translation cache save failed:", error.message);
  }
}

async function translateWithCache(originalText, convertedText, sourceLang, targetLang) {
  const cached = await findCachedTranslation(originalText, sourceLang, targetLang);
  if (cached) return cached;

  const cacheKey = getCacheKey(originalText, sourceLang, targetLang);
  if (inflightTranslations.has(cacheKey)) {
    return inflightTranslations.get(cacheKey);
  }

  const translationPromise = translate(convertedText, sourceLang, targetLang)
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
  if (!originalText) return "";

  let sourceLang = "auto";
  let convertedText = originalText;

  if (isRomaji(originalText)) {
    sourceLang = "ja";
    convertedText = romajiToKatakana(originalText);
  }

  try {
    return await translateWithCache(originalText, convertedText, sourceLang, targetLang);
  } catch (error) {
    if (error.status !== 429) {
      console.error("Translation failed:", error.message);
    }

    return text;
  }
}
