const WINDOW_MS = 15 * 60 * 1000;
const requestBuckets = new Map();

const cleanupTimer = setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of requestBuckets) {
    if (bucket.resetAt <= now) requestBuckets.delete(key);
  }
}, 60 * 1000);
cleanupTimer.unref();

function consumeMemoryBucket(key, windowMs) {
  const now = Date.now();
  const current = requestBuckets.get(key);
  const bucket = !current || current.resetAt <= now ? { count: 0, resetAt: now + windowMs } : current;
  bucket.count += 1;
  requestBuckets.set(key, bucket);
  return bucket;
}

export function createRateLimiter({ limit, windowMs = WINDOW_MS, store = null, name = "request" }) {
  return async (req, res, next) => {
    const now = Date.now();
    const identity = req.ip || req.socket?.remoteAddress || "unknown";
    const key = `${name}:${identity}`;
    let bucket;

    if (store?.isReady) {
      try {
        const redisKey = `rate-limit:${key}`;
        const count = await store.incr(redisKey);
        if (count === 1) await store.pExpire(redisKey, windowMs);
        const ttl = await store.pTTL(redisKey);
        bucket = { count, resetAt: now + Math.max(ttl, 0) };
      } catch (error) {
        console.error("Rate limit Redis failure; using memory fallback:", error.message);
      }
    }

    if (!bucket) bucket = consumeMemoryBucket(key, windowMs);

    res.setHeader("RateLimit-Limit", limit);
    res.setHeader("RateLimit-Remaining", Math.max(limit - bucket.count, 0));
    res.setHeader("RateLimit-Reset", Math.ceil(bucket.resetAt / 1000));

    if (bucket.count > limit) {
      res.setHeader("Retry-After", Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)));
      return res.status(429).json({ message: "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요." });
    }
    return next();
  };
}

export function securityHeaders(req, res, next) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  next();
}

export function verifyRequestOrigin(allowedOrigins) {
  const safeMethods = new Set(["GET", "HEAD", "OPTIONS"]);
  return (req, res, next) => {
    if (safeMethods.has(req.method)) return next();
    const origin = req.get("origin");
    if (!origin || allowedOrigins.includes(origin)) return next();
    return res.status(403).json({ message: "허용되지 않은 요청 출처입니다." });
  };
}
