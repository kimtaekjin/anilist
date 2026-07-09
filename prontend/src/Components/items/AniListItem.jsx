import axios from "axios";

const API_URL = process.env.REACT_APP_CLIENT_URL;
const BROWSER_CACHE_TTL_MS = 1000 * 60 * 60 * 24;
const CACHE_PREFIX = "aniwiki:anime";

function isBrowser() {
  return typeof window !== "undefined" && Boolean(window.localStorage);
}

function stableParams(params = {}) {
  return Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== null && value !== "")
    .sort(([a], [b]) => a.localeCompare(b));
}

function getListCacheKey(type, selectedSeason, selectedYear, extraParams = {}) {
  const params = {
    season: selectedSeason,
    year: selectedYear,
    ...extraParams,
  };

  const suffix = stableParams(params)
    .map(([key, value]) => `${key}=${value}`)
    .join("&");

  return `${CACHE_PREFIX}:list:${type}${suffix ? `:${suffix}` : ""}`;
}

function getHomeCacheKey(limit) {
  return `${CACHE_PREFIX}:home:limit=${limit}`;
}

function readCache(key) {
  if (!isBrowser()) return null;

  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;

    const cached = JSON.parse(raw);
    if (!cached?.savedAt || Date.now() - cached.savedAt > BROWSER_CACHE_TTL_MS) {
      window.localStorage.removeItem(key);
      return null;
    }

    return cached.data;
  } catch {
    return null;
  }
}

function writeCache(key, data) {
  if (!isBrowser() || !data) return;

  try {
    window.localStorage.setItem(
      key,
      JSON.stringify({
        savedAt: Date.now(),
        data,
      }),
    );
  } catch {
    // localStorage quota errors should not block rendering.
  }
}

function formatAnime(anime, type) {
  const e = { ...anime };

  if (e.startDate && typeof e.startDate === "object") {
    const year = e.startDate.year ?? "";
    const month = e.startDate.month ? String(e.startDate.month).padStart(2, "0") : "";
    const day = e.startDate.day ? String(e.startDate.day).padStart(2, "0") : "";
    e.startDate = `${year}${month ? "-" + month : ""}${day ? "-" + day : ""}`;
  }

  if (type === "ova") {
    e.episodes = "";
  }

  return e;
}

function formatAnimeList(animeList, type) {
  return (Array.isArray(animeList) ? animeList : []).map((anime) => formatAnime(anime, type));
}

export function getCachedAniList(type, selectedSeason, selectedYear, extraParams = {}) {
  return readCache(getListCacheKey(type, selectedSeason, selectedYear, extraParams));
}

export function getCachedHomeAnime(limit = 30) {
  return readCache(getHomeCacheKey(limit));
}

export const fetchAniList = async (type, selectedSeason, selectedYear, extraParams = {}) => {
  const body = {
    season: selectedSeason,
    year: selectedYear,
    ...extraParams,
  };
  const cacheKey = getListCacheKey(type, selectedSeason, selectedYear, extraParams);

  try {
    const response = await axios.get(`${API_URL}/service/anime/${type}`, {
      params: body,
    });

    const formatted = formatAnimeList(response.data, type);
    writeCache(cacheKey, formatted);
    return formatted;
  } catch (error) {
    console.error("error:", error);
    return readCache(cacheKey) || [];
  }
};

export const fetchHomeAnime = async (limit = 30) => {
  const cacheKey = getHomeCacheKey(limit);

  try {
    const response = await axios.get(`${API_URL}/service/anime/home`, {
      params: { limit },
    });

    const formatted = {
      trending: formatAnimeList(response.data?.trending, "trending"),
      completed: formatAnimeList(response.data?.completed, "completed"),
      ova: formatAnimeList(response.data?.ova, "ova"),
    };

    writeCache(cacheKey, formatted);
    return formatted;
  } catch (error) {
    console.error("error:", error);
    return readCache(cacheKey) || { trending: [], completed: [], ova: [] };
  }
};

export const fetchDetailAnime = async (type, id) => {
  try {
    const response = await axios.get(`${API_URL}/service/anime/detail/${id}`, { params: { type } });
    let animeData = response.data;

    if (Array.isArray(animeData)) {
      animeData = animeData[0];
    }

    if (animeData?.startDate && typeof animeData.startDate === "object") {
      const { year = "", month, day } = animeData.startDate;
      animeData.startDate = `${year}${month ? "-" + String(month).padStart(2, "0") : ""}${
        day ? "-" + String(day).padStart(2, "0") : ""
      }`;
    }

    return animeData;
  } catch (error) {
    console.error(error);
  }
};
