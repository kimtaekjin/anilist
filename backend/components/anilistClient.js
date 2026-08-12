import redis from "../config/redis.js";

const ANILIST_ENDPOINT = "https://graphql.anilist.co";
const REQUEST_TIMEOUT_MS = Number(process.env.ANILIST_REQUEST_TIMEOUT_MS || 15000);
const MIN_REQUEST_INTERVAL_MS = Number(process.env.ANILIST_MIN_REQUEST_INTERVAL_MS || 2200);
const MAX_RETRIES = Number(process.env.ANILIST_MAX_RETRIES || 5);
const RATE_LIMIT_KEY = process.env.ANILIST_RATE_LIMIT_KEY || "lock:anilist:request-slot";

let requestQueue = Promise.resolve();
let nextRequestAt = 0;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function getNumericHeader(response, name) {
  const value = response.headers.get(name);
  if (value === null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function getRetryDelay(response, retryCount) {
  const retryAfterHeader = response.headers.get("retry-after");
  const retryAfterSeconds = Number(retryAfterHeader);
  if (retryAfterHeader && Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0) {
    return retryAfterSeconds * 1000;
  }

  if (retryAfterHeader) {
    const retryAt = Date.parse(retryAfterHeader);
    if (Number.isFinite(retryAt)) return Math.max(1000, retryAt - Date.now());
  }

  const resetAt = getNumericHeader(response, "x-ratelimit-reset");
  if (resetAt && resetAt > 0) {
    return Math.max(1000, resetAt * 1000 - Date.now());
  }

  return Math.min(60000, 3000 * 2 ** retryCount);
}

async function deferRequests(delayMs) {
  nextRequestAt = Math.max(nextRequestAt, Date.now() + delayMs);

  if (!redis.isReady) return;
  await redis
    .set(RATE_LIMIT_KEY, "cooldown", { PX: Math.max(1, Math.ceil(delayMs)) })
    .catch((error) => console.error("AniList shared cooldown failed:", error.message));
}

async function updateRateLimitWindow(response) {
  const remaining = getNumericHeader(response, "x-ratelimit-remaining");
  const resetAt = getNumericHeader(response, "x-ratelimit-reset");

  if (remaining !== null && remaining <= 1 && resetAt && resetAt > 0) {
    await deferRequests(Math.max(1000, resetAt * 1000 - Date.now()));
  }
}

async function waitForSharedRequestSlot() {
  if (!redis.isReady) return;

  while (redis.isReady) {
    try {
      const acquired = await redis.set(RATE_LIMIT_KEY, `${process.pid}:${Date.now()}`, {
        NX: true,
        PX: MIN_REQUEST_INTERVAL_MS,
      });
      if (acquired) return;

      const ttl = await redis.pTTL(RATE_LIMIT_KEY);
      await sleep(Math.max(100, ttl > 0 ? ttl : 100));
    } catch (error) {
      console.error("AniList shared rate limiter failed; using local limiter:", error.message);
      return;
    }
  }
}

async function waitForRequestSlot() {
  const waitMs = Math.max(0, nextRequestAt - Date.now());
  if (waitMs) await sleep(waitMs);
  await waitForSharedRequestSlot();
  nextRequestAt = Date.now() + MIN_REQUEST_INTERVAL_MS;
}

async function executeRequest(query, variables, retryCount = 0) {
  await waitForRequestSlot();

  let response;
  try {
    response = await fetch(ANILIST_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ query, variables }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    if (retryCount >= MAX_RETRIES) throw error;
    await sleep(Math.min(30000, 1000 * 2 ** retryCount));
    return executeRequest(query, variables, retryCount + 1);
  }

  await updateRateLimitWindow(response);

  let payload;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  const graphQLError = payload?.errors?.[0];
  const status = graphQLError?.status || response.status;

  if ((status === 429 || status >= 500) && retryCount < MAX_RETRIES) {
    const delay = getRetryDelay(response, retryCount);
    await deferRequests(delay);
    console.warn(`AniList ${status}: retrying after ${delay}ms.`);
    await sleep(delay);
    return executeRequest(query, variables, retryCount + 1);
  }

  if (!response.ok || graphQLError) {
    const error = new Error(graphQLError?.message || `AniList request failed (${response.status})`);
    error.status = status;
    error.payload = payload;
    throw error;
  }

  return payload.data;
}

export function requestAniList(query, variables = {}) {
  const request = requestQueue.then(() => executeRequest(query, variables));
  requestQueue = request.catch(() => {});
  return request;
}
