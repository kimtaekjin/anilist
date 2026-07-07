import express from "express";
import { localizeGenre } from "../components/animeLocalization.js";
import { translateItem } from "../components/translateItem.js";
import { queries } from "../components/animeQuery.js";
import { fetchAnime } from "../components/fetchAnime.js";
import redis from "../config/redis.js";
import Anime from "../models/anime.js";

const router = express.Router();

router.use(express.json());

const ANILIST_ENDPOINT = "https://graphql.anilist.co";
const SUPPORTED_LIST_TYPES = ["trending", "completed", "ova", "airing", "genre", "upcoming"];
const MIN_LIST_ITEMS = Number(process.env.ANIME_MIN_LIST_ITEMS || 20);
const LIST_CACHE_TTL_SECONDS = Number(process.env.ANIME_LIST_CACHE_TTL_SECONDS || 600);
const DETAIL_CACHE_TTL_SECONDS = Number(process.env.ANIME_DETAIL_CACHE_TTL_SECONDS || 600);
const RESPONSE_CACHE_VERSION = "deepl-ko-v1";
const listFetchLocks = new Map();

function normalizeAnimeType(type) {
  return type === "upcomming" ? "upcoming" : type;
}

function getDefaultSeasonYear() {
  const now = new Date();
  const month = now.getMonth() + 1;
  const season = month <= 3 ? "WINTER" : month <= 6 ? "SPRING" : month <= 9 ? "SUMMER" : "FALL";

  return {
    season,
    year: now.getFullYear(),
  };
}

function normalizeListQuery(type, query) {
  const defaults = getDefaultSeasonYear();

  if (type === "genre") {
    return {
      season: (query.season || defaults.season).toUpperCase(),
      year: Number(query.year) || defaults.year,
    };
  }

  return {};
}

function getListCacheKey(type, normalizedQuery) {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(normalizedQuery)) {
    if (value !== undefined && value !== null && value !== "") {
      params.set(key, String(value));
    }
  }

  const suffix = params.toString();
  return suffix ? `anime:${type}:${suffix}` : `anime:${type}`;
}
function getDetailCacheKey(type, animeId) {
  return `anime:detail:${type}:${animeId}`;
}

function safeJsonParse(value) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function createResponseCachePayload(data) {
  return JSON.stringify({
    version: RESPONSE_CACHE_VERSION,
    data,
  });
}

function readResponseCachePayload(cached) {
  const parsed = safeJsonParse(cached);
  if (!parsed) return null;

  return parsed.version === RESPONSE_CACHE_VERSION ? parsed.data : null;
}
function getListDbFilter(type, normalizedQuery) {
  const filter = {
    contentTypes: { $in: [type] },
  };

  if (type === "genre") {
    filter.season = normalizedQuery.season;
    filter.seasonYear = normalizedQuery.year;
  }

  return filter;
}

async function fetchListWithLock(cacheKey, query, type, normalizedQuery) {
  if (listFetchLocks.has(cacheKey)) {
    return listFetchLocks.get(cacheKey);
  }

  const promise = fetchAnime(query, type, normalizedQuery).finally(() => {
    listFetchLocks.delete(cacheKey);
  });

  listFetchLocks.set(cacheKey, promise);
  return promise;
}

function isLikelyUntranslatedTitle(anime) {
  const title = anime?.title;
  if (!title) return false;

  if (/[가-힣]/.test(title)) return false;
  if (/[\u3040-\u30ff\u3400-\u9fff]/.test(title)) return true;

  return Boolean(anime.originalTitle?.native || anime.originalTitle?.romaji || anime.originalTitle?.english);
}

async function localizeAnimeForResponse(anime) {
  const item = anime.toObject ? anime.toObject() : { ...anime };

  item.genres = Array.isArray(item.genres)
    ? await Promise.all(item.genres.map((genre) => localizeGenre(genre)))
    : [];

  if (isLikelyUntranslatedTitle(item)) {
    const sourceTitle = item.originalTitle?.native || item.originalTitle?.romaji || item.title;
    item.title = await translateItem(sourceTitle).catch(() => item.title);
  }

  if (!Array.isArray(item.studio) || !item.studio.length) {
    item.studio = ["미정"];
  }

  return item;
}

async function localizeListForResponse(data) {
  return Promise.all(data.map((anime) => localizeAnimeForResponse(anime)));
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
    titleText ? translateItem(titleText) : "",
    cleanDescription ? translateItem(cleanDescription) : "줄거리 정보 없음",
    data.genres
      ? Promise.all(data.genres.map((genre) => localizeGenre(genre)))
      : [],
  ]);

  const characters = data.characters?.edges
    ? await Promise.all(
        data.characters.edges.map(async (edge) => ({
          role: edge.role,
          name: {
            full: edge.node.name.full,
            native: edge.node.name.native
              ? await translateItem(edge.node.name.native).catch(() => edge.node.name.native)
              : null,
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
  const detailCacheKey = getDetailCacheKey(type, animeId);
  let media;

  try {
    if (!queries[type]) {
      return res.status(400).json({ message: "지원하지 않는 애니 타입입니다." });
    }

    if (redis.isOpen) {
      const cached = await redis.get(detailCacheKey);
      const cachedData = cached ? readResponseCachePayload(cached) : null;
      if (cachedData) {
        console.log(`Redis HIT ${detailCacheKey}`);
        return res.status(200).json(cachedData);
      }
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
        } else {
          throw error;
        }
      }
    }

    const localizedMedia = await localizeAnimeForResponse(media);

    if (redis.isOpen) {
      await redis.setEx(detailCacheKey, DETAIL_CACHE_TTL_SECONDS, createResponseCachePayload(localizedMedia));
    }

    return res.status(200).json(localizedMedia);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "서버 내부 오류가 발생했습니다." });
  }
});

router.get("/anime/:type", async (req, res) => {
  const type = normalizeAnimeType(req.params.type);

  try {
    if (!SUPPORTED_LIST_TYPES.includes(type)) {
      return res.status(400).json({ error: "지원하지 않는 애니 타입입니다." });
    }

    const normalizedQuery = normalizeListQuery(type, req.query);
    const cacheKey = getListCacheKey(type, normalizedQuery);
    const dbFilter = getListDbFilter(type, normalizedQuery);
    const cached = redis.isOpen ? await redis.get(cacheKey) : null;

    if (cached) {
      const cachedData = readResponseCachePayload(cached);
      if (Array.isArray(cachedData) && cachedData.length >= MIN_LIST_ITEMS) {
        console.log(`Redis HIT ${cacheKey}`);
        return res.json(cachedData);
      }

      const legacyCachedData = safeJsonParse(cached);
      if (Array.isArray(legacyCachedData) && legacyCachedData.length >= MIN_LIST_ITEMS) {
        console.log(`Redis HIT legacy ${cacheKey}`);
        const localizedLegacyData = await localizeListForResponse(legacyCachedData);
        if (redis.isOpen) {
          await redis.setEx(cacheKey, LIST_CACHE_TTL_SECONDS, createResponseCachePayload(localizedLegacyData));
        }
        return res.json(localizedLegacyData);
      }

      console.log(`Redis HIT but insufficient ${cacheKey}`);
    }

    console.log(`Redis MISS ${cacheKey}`);

    let data = await Anime.find(dbFilter).sort({ popularity: -1, averageScore: -1 }).lean();

    if (data.length < MIN_LIST_ITEMS) {
      try {
        await fetchListWithLock(cacheKey, queries[type], type, normalizedQuery);
        data = await Anime.find(dbFilter).sort({ popularity: -1, averageScore: -1 }).lean();
      } catch (error) {
        if (!data.length) {
          throw error;
        }

        console.error(`[${type}] AniList fetch failed, returning DB data:`, error);
      }
    }

    const localizedData = await localizeListForResponse(data);

    if (redis.isOpen) {
      await redis.setEx(cacheKey, LIST_CACHE_TTL_SECONDS, createResponseCachePayload(localizedData));
    }

    return res.json(localizedData);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "서버 오류" });
  }
});

export default router;





