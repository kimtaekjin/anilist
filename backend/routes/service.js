import express from "express";
import { localizeGenre } from "../components/animeLocalization.js";
import { translateItem } from "../components/translateItem.js";
import { queries } from "../components/animeQuery.js";
import redis from "../config/redis.js";
import Anime from "../models/anime.js";
import { requestAniList } from "../components/anilistClient.js";

const router = express.Router();

router.use(express.json());

const SUPPORTED_LIST_TYPES = ["trending", "completed", "ova", "airing", "genre", "upcoming"];
const LIST_CACHE_TTL_SECONDS = Number(process.env.ANIME_LIST_CACHE_TTL_SECONDS || 60 * 60 * 24);
const GENRE_CACHE_TTL_SECONDS = Number(process.env.ANIME_GENRE_CACHE_TTL_SECONDS || 60 * 60 * 24 * 30);
const DETAIL_CACHE_TTL_SECONDS = Number(process.env.ANIME_DETAIL_CACHE_TTL_SECONDS || 60 * 60 * 24);
const MAX_RESPONSE_LIMIT = 30;
const RESPONSE_CACHE_VERSION = "catalog-ko-v3";
const CATALOG_START_YEAR = Number(process.env.ANIME_CATALOG_START_YEAR || 2000);
const VALID_SEASONS = new Set(["WINTER", "SPRING", "SUMMER", "FALL"]);
const LIST_RESPONSE_FIELDS = [
  "_id",
  "idMal",
  "title",
  "originalTitle",
  "image",
  "bannerImage",
  "genres",
  "days",
  "startDate",
  "season",
  "seasonYear",
  "episodes",
  "status",
  "averageScore",
  "popularity",
  "studio",
  "type",
  "nextAiringEpisode",
].join(" ");

async function readRedisCache(key) {
  if (!redis.isReady) return null;

  try {
    return await redis.get(key);
  } catch (error) {
    console.error(`Redis GET failed (${key}):`, error.message);
    return null;
  }
}

async function writeRedisCache(key, ttlSeconds, value) {
  if (!redis.isReady) return false;

  try {
    await redis.setEx(key, ttlSeconds, value);
    return true;
  } catch (error) {
    console.error(`Redis SET failed (${key}):`, error.message);
    return false;
  }
}

function normalizeAnimeType(type) {
  return type === "upcomming" ? "upcoming" : type;
}

function getDefaultSeasonYear() {
  const kstNow = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const month = kstNow.getUTCMonth() + 1;
  const season = month <= 3 ? "WINTER" : month <= 6 ? "SPRING" : month <= 9 ? "SUMMER" : "FALL";

  return {
    season,
    year: kstNow.getUTCFullYear(),
  };
}

function normalizeListQuery(type, query) {
  const defaults = getDefaultSeasonYear();

  if (type === "genre") {
    const season = String(query.season || defaults.season).toUpperCase();
    const year = query.year === undefined ? defaults.year : Number(query.year);

    if (!VALID_SEASONS.has(season) || !Number.isInteger(year) || year < CATALOG_START_YEAR || year > defaults.year) {
      const error = new Error("올바른 연도와 분기를 입력해 주세요.");
      error.status = 400;
      throw error;
    }

    return {
      season,
      year,
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
  if (type === "genre") {
    return {
      season: normalizedQuery.season,
      seasonYear: normalizedQuery.year,
      isCatalogActive: { $ne: false },
    };
  }

  return {
    contentTypes: { $in: [type] },
  };
}

function getExcludedAnimeIds(query) {
  return String(query.exclude || "")
    .split(",")
    .map((id) => Number(id.trim()))
    .filter((id) => Number.isInteger(id) && id > 0);
}

function filterExcludedAnime(data, excludedIds) {
  if (!excludedIds.length) return data;

  const excludedSet = new Set(excludedIds);
  return data.filter((anime) => !excludedSet.has(Number(anime._id)));
}

function getResponseLimit(query) {
  const limit = Number(query.limit);
  if (!Number.isFinite(limit) || limit <= 0) return null;
  return Math.min(Math.floor(limit), MAX_RESPONSE_LIMIT);
}

function limitAnimeList(data, limit) {
  return limit ? data.slice(0, limit) : data;
}

function getListSort(type) {
  if (type === "completed") {
    return { averageScore: -1, popularity: -1 };
  }

  return { popularity: -1, averageScore: -1 };
}

function isLikelyUntranslatedTitle(anime) {
  const title = anime?.title;
  if (!title) return false;

  if (/[가-힣]/.test(title)) return false;
  return /[\u3040-\u30ff\u3400-\u9fff]/.test(title);
}

function hasUntranslatedTitles(data) {
  return data.some((anime) => isLikelyUntranslatedTitle(anime));
}

async function localizeAnimeForResponse(anime, options = {}) {
  const item = anime.toObject ? anime.toObject() : { ...anime };

  item.genres = Array.isArray(item.genres)
    ? await Promise.all(item.genres.map((genre) => localizeGenre(genre)))
    : [];

  if (isLikelyUntranslatedTitle(item)) {
    const sourceTitle = item.originalTitle?.native || item.originalTitle?.romaji || item.title;
    item.title = await translateItem(sourceTitle, { domain: "title" }).catch(() => item.title);
  }

  if (!Array.isArray(item.studio) || !item.studio.length) {
    item.studio = ["미정"];
  }

  return item;
}

async function getListDataForResponse(type, options = {}) {
  const normalizedQuery = options.normalizedQuery || {};
  const excludedIds = options.excludedIds || [];
  const responseLimit = options.limit || null;
  const cacheKey = getListCacheKey(type, normalizedQuery);
  const dbFilter = getListDbFilter(type, normalizedQuery);
  const sort = getListSort(type);
  const cached = await readRedisCache(cacheKey);

  if (cached) {
    const cachedData = readResponseCachePayload(cached);
    const filteredCachedData = Array.isArray(cachedData) ? filterExcludedAnime(cachedData, excludedIds) : null;
    if (Array.isArray(filteredCachedData)) {
      console.log(`Redis HIT ${cacheKey}`);
      return limitAnimeList(filteredCachedData, responseLimit);
    }

    const legacyCachedData = safeJsonParse(cached);
    const filteredLegacyCachedData = Array.isArray(legacyCachedData)
      ? filterExcludedAnime(legacyCachedData, excludedIds)
      : null;
    if (Array.isArray(filteredLegacyCachedData)) {
      console.log(`Redis HIT legacy ${cacheKey}`);
      return limitAnimeList(filteredLegacyCachedData, responseLimit);
    }
  }

  const dbQueryLimit = responseLimit ? responseLimit + excludedIds.length : 0;
  let dbQuery = Anime.find(dbFilter).select(LIST_RESPONSE_FIELDS).sort(sort);
  if (dbQueryLimit) {
    dbQuery = dbQuery.limit(dbQueryLimit);
  }

  const data = await dbQuery.lean();
  const responseData = filterExcludedAnime(data, excludedIds);
  const limitedData = limitAnimeList(responseData, responseLimit);

  if (redis.isReady && !excludedIds.length && !responseLimit) {
    const ttlSeconds = type === "genre" ? GENRE_CACHE_TTL_SECONDS : LIST_CACHE_TTL_SECONDS;
    void writeRedisCache(cacheKey, ttlSeconds, createResponseCachePayload(limitedData));
  }

  return limitedData;
}

async function fetchDetail(query, type, id) {
  const responseData = await requestAniList(query, { id: Number(id) });
  const data = responseData?.Media;

  if (!data) {
    throw new Error("AniList 데이터 없음");
  }

  const cleanDescription = data.description ? data.description.replace(/<[^>]*>/g, "").trim() : "";
  const titleText = data.title?.native || data.title?.romaji || data.title?.english || "";

  const [translatedTitle, translatedDescription, translatedGenres] = await Promise.all([
    titleText ? translateItem(titleText, { domain: "title" }) : "",
    cleanDescription ? translateItem(cleanDescription, { domain: "synopsis" }) : "줄거리 정보 없음",
    data.genres
      ? Promise.all(data.genres.map((genre) => localizeGenre(genre)))
      : [],
  ]);

  const characters = data.characters?.edges
    ? await Promise.all(
        data.characters.edges.map(async (edge) => ({
          anilistId: edge.node?.id || null,
          role: edge.role,
          name: {
            full: edge.node.name.full,
            native: edge.node.name.native
              ? await translateItem(edge.node.name.native, { domain: "character" }).catch(() => edge.node.name.native)
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
    updatedAt: data.updatedAt || null,
    lastCheckedAt: new Date(),
    lastSyncedAt: new Date(),
  };

  const { _id, ...resultFields } = result;

  await Anime.updateOne(
    { _id },
    {
      $set: resultFields,
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

    if (redis.isReady) {
      const cached = await readRedisCache(detailCacheKey);
      const cachedData = cached ? readResponseCachePayload(cached) : null;
      if (cachedData) {
        console.log(`Redis HIT ${detailCacheKey}`);
        return res.status(200).json(cachedData);
      }
    }

    media = await Anime.findOne({ _id: animeId, contentTypes: type });
    const isDetailMissing = !media || !media.description || !media.image?.large;

    if (isDetailMissing) {
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

    if (redis.isReady && !isLikelyUntranslatedTitle(localizedMedia)) {
      await writeRedisCache(detailCacheKey, DETAIL_CACHE_TTL_SECONDS, createResponseCachePayload(localizedMedia));
    }

    return res.status(200).json(localizedMedia);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "서버 내부 오류가 발생했습니다." });
  }
});

router.get("/anime/home", async (req, res) => {
  const responseLimit = getResponseLimit(req.query) || MAX_RESPONSE_LIMIT;
  const homeCacheKey = `anime:home:limit=${responseLimit}`;

  try {
    if (redis.isReady) {
      const cached = await readRedisCache(homeCacheKey);
      const cachedData = cached ? readResponseCachePayload(cached) : null;
      if (cachedData) {
        console.log(`Redis HIT ${homeCacheKey}`);
        return res.json(cachedData);
      }
    }

    const [trending, ova] = await Promise.all([
      getListDataForResponse("trending", { limit: responseLimit }),
      getListDataForResponse("ova", { limit: responseLimit }),
    ]);

    const trendingIds = trending.map((anime) => Number(anime._id)).filter((id) => Number.isInteger(id));
    const completed = await getListDataForResponse("completed", {
      excludedIds: trendingIds,
      limit: responseLimit,
    });

    const homeData = {
      trending,
      completed,
      ova,
    };

    if (redis.isReady && !Object.values(homeData).some(hasUntranslatedTitles)) {
      await writeRedisCache(homeCacheKey, LIST_CACHE_TTL_SECONDS, createResponseCachePayload(homeData));
    }

    return res.json(homeData);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "서버 오류" });
  }
});

router.get("/anime/:type", async (req, res) => {
  const type = normalizeAnimeType(req.params.type);

  try {
    if (!SUPPORTED_LIST_TYPES.includes(type)) {
      return res.status(400).json({ error: "지원하지 않는 애니 타입입니다." });
    }

    const normalizedQuery = normalizeListQuery(type, req.query);
    const excludedIds = getExcludedAnimeIds(req.query);
    const responseLimit = getResponseLimit(req.query);
    const data = await getListDataForResponse(type, {
      normalizedQuery,
      excludedIds,
      limit: responseLimit,
    });

    return res.json(data);
  } catch (err) {
    console.error(err);
    return res.status(err.status || 500).json({ error: err.status === 400 ? err.message : "서버 오류" });
  }
});

export default router;





