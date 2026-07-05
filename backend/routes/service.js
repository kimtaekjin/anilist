import express from "express";
import { queries } from "../components/animeQuery.js";
import { fetchAnime } from "../components/fetchAnime.js";
import { fetchJikanDetail } from "../components/jikanAdapter.js";
import redis from "../config/redis.js";
import Anime from "../models/anime.js";

const router = express.Router();

router.use(express.json());

function normalizeAnimeType(type) {
  return type === "upcomming" ? "upcoming" : type;
}

async function fetchDetail(_query, type, id) {
  const result = await fetchJikanDetail(id);

  await Anime.updateOne(
    { _id: result._id },
    {
      $set: result,
      $addToSet: { contentTypes: type },
    },
    { upsert: true, runValidators: true },
  );

  return result;
}

router.get("/anime/detail/:id", async (req, res) => {
  const animeId = req.params.id;
  const type = normalizeAnimeType(req.query.type || "detail");
  let media;

  try {
    if (!queries[type]) {
      return res.status(400).json({ message: "지원하지 않는 애니 타입입니다." });
    }

    const cacheDuration = 24 * 60 * 60 * 1000;
    const now = new Date();

    media = await Anime.findOne({ _id: animeId, contentTypes: type });
    const isStale = !media || !media.lastSyncedAt || now - media.lastSyncedAt > cacheDuration;

    if (!media || isStale) {
      try {
        media = await fetchDetail(queries[type], type, animeId);
      } catch (error) {
        if (media && (error.status === 429 || error.status >= 500)) {
          console.error("Jikan API unavailable, returning stale detail data:", error);
          return res.status(200).json(media);
        }

        throw error;
      }
    }

    return res.status(200).json(media);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "서버 내부 오류가 발생했습니다." });
  }
});

router.get("/anime/:type", async (req, res) => {
  const type = normalizeAnimeType(req.params.type);

  const cacheKey = `anime:${type}`;

  try {
    if (!queries[type] && !["trending", "completed", "ova", "airing", "genre", "upcoming"].includes(type)) {
      return res.status(400).json({ error: "지원하지 않는 애니 타입입니다." });
    }

    const cached = redis.isOpen ? await redis.get(cacheKey) : null;

    if (cached) {
      console.log("Redis HIT");
      return res.json(JSON.parse(cached));
    }

    console.log("Redis MISS");

    const data = await Anime.find({ contentTypes: { $in: [type] } });

    if (redis.isOpen) {
      await redis.setEx(cacheKey, 600, JSON.stringify(data));
    }

    return res.json(data);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "서버 오류" });
  }
});

export default router;
