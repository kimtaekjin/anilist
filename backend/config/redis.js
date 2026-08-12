import { createClient } from "redis";

const CONNECT_TIMEOUT_MS = Number(process.env.REDIS_CONNECT_TIMEOUT_MS || 3000);
const MAX_RECONNECT_ATTEMPTS = Number(process.env.REDIS_MAX_RECONNECT_ATTEMPTS || 3);

const redis = createClient({
  url: process.env.REDIS_URL || "redis://127.0.0.1:6379",
  socket: {
    connectTimeout: CONNECT_TIMEOUT_MS,
    reconnectStrategy: (retries) => {
      if (retries >= MAX_RECONNECT_ATTEMPTS) return false;
      return Math.min(2000, 250 * 2 ** retries);
    },
  },
});

redis.on("error", (err) => console.error("Redis error:", err));

redis
  .connect()
  .then(() => console.log("Redis connected"))
  .catch((err) => console.error("Redis connection failed; MongoDB fallback will be used:", err.message));

export default redis;
