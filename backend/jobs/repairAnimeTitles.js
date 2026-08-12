import "dotenv/config";
import mongoose from "mongoose";
import redis from "../config/redis.js";
import { translateItem } from "../components/translateItem.js";
import Anime from "../models/anime.js";

const JAPANESE_PATTERN = /[\u3040-\u30ff\u3400-\u9fff]/;
const KOREAN_PATTERN = /[가-힣]/;

async function run() {
  let repaired = 0;
  let failed = 0;

  try {
    await mongoose.connect(process.env.MONGO_URI);

    const cursor = Anime.find({})
      .select("_id title originalTitle")
      .lean()
      .cursor();

    for await (const anime of cursor) {
      if (KOREAN_PATTERN.test(anime.title || "") || !JAPANESE_PATTERN.test(anime.title || "")) continue;

      const sourceTitle = anime.originalTitle?.native || anime.originalTitle?.romaji || anime.title;
      const translatedTitle = await translateItem(sourceTitle);

      if (!translatedTitle || JAPANESE_PATTERN.test(translatedTitle)) {
        failed += 1;
        console.warn(`[${anime._id}] 제목 번역 실패: ${anime.title}`);
        continue;
      }

      await Anime.updateOne({ _id: anime._id }, { $set: { title: translatedTitle } });
      repaired += 1;
    }

    if (redis.isReady) {
      const keys = [];
      for await (const key of redis.scanIterator({ MATCH: "anime:*", COUNT: 100 })) {
        if (Array.isArray(key)) keys.push(...key);
        else keys.push(key);
      }
      if (keys.length) await redis.del(keys);
    }

    console.log(`애니 제목 복구 완료: 성공 ${repaired}개, 실패 ${failed}개`);
  } catch (error) {
    console.error("애니 제목 복구 실패:", error);
    process.exitCode = 1;
  } finally {
    if (redis.isOpen) await redis.quit().catch(() => {});
    await mongoose.disconnect().catch(() => {});
  }
}

run();
