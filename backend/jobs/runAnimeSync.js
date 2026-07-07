import "dotenv/config";
import mongoose from "mongoose";
import redis from "../config/redis.js";
import { syncAll } from "./syncAnime.js";

async function run() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    await syncAll({ typeDelayMs: process.env.ANIME_SYNC_JOB_TYPE_DELAY_MS });
  } catch (error) {
    console.error("애니 동기화 job 실패:", error);
    process.exitCode = 1;
  } finally {
    if (redis.isOpen) {
      await redis.quit().catch(() => {});
    }
    await mongoose.disconnect().catch(() => {});
  }
}

run();
