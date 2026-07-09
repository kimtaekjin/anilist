import Anime from "../models/anime.js";
import redis from "../config/redis.js";
import { fetchAnime } from "../components/fetchAnime.js";
import { queries } from "../components/animeQuery.js";

const DEFAULT_INTERVAL = 1000 * 60 * 60 * 24;
const DEFAULT_TYPE_DELAY = 1000 * 60;
const DEFAULT_STARTUP_DELAY = 1000 * 60;
const LIST_CACHE_TTL_SECONDS = Number(process.env.ANIME_LIST_CACHE_TTL_SECONDS || 60 * 60 * 24);
const RESPONSE_CACHE_VERSION = "deepl-ko-v1";
const HOME_LIMIT = 30;
const SEASONS = ["WINTER", "SPRING", "SUMMER", "FALL"];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const syncTargets = [
  ["trending", queries.trending],
  ["airing", queries.airing],
  ["completed", queries.completed],
  ["ova", queries.ova],
  ["upcoming", queries.upcoming],
];

function createResponseCachePayload(data) {
  return JSON.stringify({
    version: RESPONSE_CACHE_VERSION,
    data,
  });
}

function getListSort(type) {
  if (type === "completed") {
    return { averageScore: -1, popularity: -1 };
  }

  return { popularity: -1, averageScore: -1 };
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

function getGenrePrecacheRange() {
  const now = new Date();
  const currentYear = now.getFullYear();
  const yearsBack = Number(process.env.ANIME_GENRE_PRECACHE_YEARS_BACK || 5);
  const yearsAhead = Number(process.env.ANIME_GENRE_PRECACHE_YEARS_AHEAD || 1);
  const startYear = currentYear - yearsBack;
  const endYear = currentYear + yearsAhead;
  const targets = [];

  for (let year = startYear; year <= endYear; year += 1) {
    for (const season of SEASONS) {
      targets.push({ season, year });
    }
  }

  return targets;
}

function getListCacheKey(type, normalizedQuery = {}) {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(normalizedQuery)) {
    if (value !== undefined && value !== null && value !== "") {
      params.set(key, String(value));
    }
  }

  const suffix = params.toString();
  return suffix ? `anime:${type}:${suffix}` : `anime:${type}`;
}

function getNormalizedQuery(type, override = {}) {
  if (type === "genre") {
    const defaults = getDefaultSeasonYear();
    return {
      season: override.season || defaults.season,
      year: override.year || defaults.year,
    };
  }

  return {};
}

function getDbFilter(type, normalizedQuery = {}) {
  const filter = {
    contentTypes: { $in: [type] },
  };

  if (type === "genre") {
    filter.season = normalizedQuery.season;
    filter.seasonYear = normalizedQuery.year;
  }

  return filter;
}

async function getListFromDb(type) {
  return Anime.find(getDbFilter(type, getNormalizedQuery(type))).sort(getListSort(type)).lean();
}

async function getGenreListFromDb(target) {
  const normalizedQuery = getNormalizedQuery("genre", target);
  return Anime.find(getDbFilter("genre", normalizedQuery)).sort(getListSort("genre")).lean();
}

async function saveListCache(type) {
  if (!redis.isOpen) return [];

  const data = await getListFromDb(type);
  if (!data.length) return data;

  await redis.setEx(getListCacheKey(type, getNormalizedQuery(type)), LIST_CACHE_TTL_SECONDS, createResponseCachePayload(data));
  console.log(`[${type}] Redis 목록 캐시 저장: ${data.length}개`);
  return data;
}

async function saveGenreCache(target) {
  if (!redis.isOpen) return [];

  const normalizedQuery = getNormalizedQuery("genre", target);
  const data = await getGenreListFromDb(normalizedQuery);
  if (!data.length) return data;

  await redis.setEx(
    getListCacheKey("genre", normalizedQuery),
    LIST_CACHE_TTL_SECONDS,
    createResponseCachePayload(data),
  );
  console.log(`[genre ${normalizedQuery.year} ${normalizedQuery.season}] Redis 목록 캐시 저장: ${data.length}개`);
  return data;
}

function excludeAnime(data, excludedIds) {
  if (!excludedIds.length) return data;

  const excludedSet = new Set(excludedIds);
  return data.filter((anime) => !excludedSet.has(Number(anime._id)));
}

async function warmHomeCache() {
  if (!redis.isOpen) return;

  const [trending, completed, ova] = await Promise.all([
    getListFromDb("trending"),
    getListFromDb("completed"),
    getListFromDb("ova"),
  ]);

  const trendingItems = trending.slice(0, HOME_LIMIT);
  const trendingIds = trendingItems.map((anime) => Number(anime._id)).filter((id) => Number.isInteger(id));

  const homeData = {
    trending: trendingItems,
    completed: excludeAnime(completed, trendingIds).slice(0, HOME_LIMIT),
    ova: ova.slice(0, HOME_LIMIT),
  };

  await redis.setEx(`anime:home:limit=${HOME_LIMIT}`, LIST_CACHE_TTL_SECONDS, createResponseCachePayload(homeData));
  console.log("[home] Redis 홈 캐시 저장");
}

async function warmListCaches() {
  if (!redis.isOpen) {
    console.log("Redis가 연결되지 않아 애니 캐시 워밍을 건너뜁니다.");
    return;
  }

  for (const [type] of syncTargets) {
    await saveListCache(type);
  }

  for (const target of getGenrePrecacheRange()) {
    await saveGenreCache(target);
  }

  await warmHomeCache();
}

async function syncGenrePrecache(typeDelay) {
  const targets = getGenrePrecacheRange();

  console.log(`장르 분기 데이터 선동기화 시작: ${targets.length}개 조합`);

  for (const target of targets) {
    try {
      await fetchAnime(queries.genre, "genre", target);
      await sleep(typeDelay);
    } catch (err) {
      console.error(`[genre ${target.year} ${target.season}] 동기화 실패:`, err);
      if (err.status === 429 || err.status === 403 || err.status >= 500) {
        console.error("AniList 호출 제한 또는 일시 장애로 장르 선동기화를 중단합니다.");
        break;
      }
      await sleep(typeDelay);
    }
  }
}

export async function syncAll(options = {}) {
  const typeDelay = Number(options.typeDelayMs ?? process.env.ANIME_SYNC_TYPE_DELAY_MS ?? DEFAULT_TYPE_DELAY);

  console.log("애니 데이터 동기화 시작");

  for (const [type, query] of syncTargets) {
    try {
      await fetchAnime(query, type);
      await sleep(typeDelay);
    } catch (err) {
      console.error(`[${type}] 동기화 실패:`, err);
      if (err.status === 429 || err.status === 403 || err.status >= 500) {
        console.error("AniList 호출 제한 또는 일시 장애로 이번 동기화 사이클을 중단합니다.");
        break;
      }
      await sleep(typeDelay);
    }
  }

  await syncGenrePrecache(typeDelay);
  await warmListCaches();
  console.log("애니 데이터 동기화 종료");
}

export function startAnimeSync(options = {}) {
  const interval = Number(options.intervalMs ?? process.env.ANIME_SYNC_INTERVAL_MS ?? DEFAULT_INTERVAL);
  const startupDelay = Number(options.startupDelayMs ?? process.env.ANIME_SYNC_STARTUP_DELAY_MS ?? DEFAULT_STARTUP_DELAY);

  const timeoutId = setTimeout(syncAll, startupDelay);
  const intervalId = setInterval(syncAll, interval);

  return {
    timeoutId,
    intervalId,
    stop() {
      clearTimeout(timeoutId);
      clearInterval(intervalId);
    },
  };
}
