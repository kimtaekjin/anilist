import express from "express";
import { traslateItem } from "../components/translateItem.js";
import { queries } from "../components/animeQuery.js";
import redis from "../config/redis.js";
import Anime from "../models/anime.js";

const router = express.Router();

router.use(express.json());

const ANILIST_ENDPOINT = "https://graphql.anilist.co";

function normalizeAnimeType(type) {
  return type === "upcomming" ? "upcoming" : type;
}

async function fetchDetail(query, type, id) {
  const response = await fetch(ANILIST_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      query,
      variables: { id: Number(id) },
    }),
  });

  const res = await response.json();

  if (res.errors?.length) {
    const firstError = res.errors[0];
    const error = new Error(firstError.message || "AniList API error");
    error.status = firstError.status || response.status;
    throw error;
  }

  const data = res?.data?.Media;

  if (!data) {
    throw new Error("AniList 데이터 없음");
  }

  const cleanDescription = data.description ? data.description.replace(/<[^>]*>/g, "").trim() : "";
  const titleText = data.title?.native || data.title?.romaji || data.title?.english || "";

  const [translatedTitle, translatedDescription, translatedGenres] = await Promise.all([
    titleText ? traslateItem(titleText) : "",
    cleanDescription ? traslateItem(cleanDescription) : "줄거리 정보 없음",
    data.genres ? Promise.all(data.genres.map((genre) => traslateItem(genre).catch(() => genre))) : [],
  ]);

  const characters = data.characters?.edges
    ? await Promise.all(
        data.characters.edges.map(async (edge) => ({
          role: edge.role,
          name: {
            full: edge.node.name.full,
            native: edge.node.name.native ? await traslateItem(edge.node.name.native).catch(() => edge.node.name.native) : null,
          },
          image: {
            large: edge.node.image?.large || null,
          },
        })),
      )
    : [];

  const result = {
    _id: data.id,
    idMal: data.idMal || null,
    title: translatedTitle,
    originalTitle: {
      romaji: data.title?.romaji || "",
      english: data.title?.english || "",
      native: data.title?.native || "",
    },
    description: translatedDescription,
    genres: translatedGenres,
    episodes: data.status === "NOT_YET_RELEASED" ? null : data.episodes || null,
    status: data.status || "",
    averageScore: data.averageScore || 0,
    popularity: data.popularity || 0,
    season: data.season || "",
    seasonYear: data.seasonYear || null,
    startDate: {
      year: data.startDate?.year || null,
      month: data.startDate?.month || null,
      day: data.startDate?.day || null,
    },
    image: {
      large: data.coverImage?.large || "",
      extraLarge: data.coverImage?.extraLarge || "",
      banner: data.bannerImage || "",
    },
    bannerImage: data.bannerImage || "",
    studio: data.studios?.edges?.map((edge) => edge.node.name).filter(Boolean) || ["미정"],
    trailer: data.trailer || null,
    characters,
    nextAiringEpisode: data.nextAiringEpisode || null,
    lastSyncedAt: new Date(),
  };

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
        if (media && (error.status === 429 || error.status >= 500 || error.status === 403)) {
          console.error("AniList API unavailable, returning stale detail data:", error);
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
