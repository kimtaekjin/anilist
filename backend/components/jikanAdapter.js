import { traslateItem } from "./translateItem.js";

const JIKAN_ENDPOINT = "https://api.jikan.moe/v4";
const JIKAN_DELAY = 3000;
const DEFAULT_RATE_LIMIT_COOLDOWN = 1000 * 60 * 5;

let jikanCooldownUntil = 0;
let lastJikanRequestAt = 0;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const seasonMap = {
  WINTER: "winter",
  SPRING: "spring",
  SUMMER: "summer",
  FALL: "fall",
};

const dayMap = {
  Sundays: "일",
  Mondays: "월",
  Tuesdays: "화",
  Wednesdays: "수",
  Thursdays: "목",
  Fridays: "금",
  Saturdays: "토",
};

const genreKoMap = {
  Action: "액션",
  Adventure: "모험",
  Comedy: "코미디",
  Drama: "드라마",
  Fantasy: "판타지",
  Horror: "호러",
  Mystery: "미스터리",
  Romance: "로맨스",
  "Sci-Fi": "SF",
  "Slice of Life": "일상",
  Sports: "스포츠",
  Supernatural: "초자연",
  Suspense: "서스펜스",
};

function createJikanError(message, status, body = "") {
  const error = new Error(message);
  error.status = status;
  error.body = body;
  return error;
}

function getRetryAfterMs(response) {
  const retryAfter = Number(response.headers.get("retry-after"));
  return Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : DEFAULT_RATE_LIMIT_COOLDOWN;
}

async function waitForJikanSlot() {
  const cooldownRemaining = jikanCooldownUntil - Date.now();
  if (cooldownRemaining > 0) {
    throw createJikanError(`Jikan rate limit cooldown active for ${Math.ceil(cooldownRemaining / 1000)}s`, 429);
  }

  const elapsed = Date.now() - lastJikanRequestAt;
  if (elapsed < JIKAN_DELAY) {
    await sleep(JIKAN_DELAY - elapsed);
  }

  lastJikanRequestAt = Date.now();
}

function normalizeFormat(type) {
  const format = {
    TV: "TV",
    Movie: "MOVIE",
    OVA: "OVA",
    ONA: "ONA",
    Special: "SPECIAL",
    Music: "MUSIC",
  };

  return format[type] || undefined;
}

function normalizeSeason(season) {
  return season ? season.toUpperCase() : "";
}

function getStartDate(anime) {
  return {
    year: anime.aired?.prop?.from?.year || null,
    month: anime.aired?.prop?.from?.month || null,
    day: anime.aired?.prop?.from?.day || null,
  };
}

function getTrailer(trailer) {
  if (!trailer?.youtube_id) return null;

  return {
    id: trailer.youtube_id,
    site: "youtube",
  };
}

async function maybeTranslate(text, shouldTranslate) {
  if (!text || !shouldTranslate) return text || "";
  return traslateItem(text).catch(() => text);
}

function normalizeGenres(genres = []) {
  return genres.map((genre) => genreKoMap[genre.name] || genre.name).filter(Boolean);
}

export async function fetchJikanJson(url, retryCount = 0) {
  await waitForJikanSlot();

  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
    },
  });

  if (response.status === 429) {
    const cooldownMs = getRetryAfterMs(response);
    jikanCooldownUntil = Date.now() + cooldownMs;
    const errorBody = await response.text();
    throw createJikanError(`Jikan API rate limited. Cooling down for ${Math.ceil(cooldownMs / 1000)}s`, 429, errorBody);
  }

  if (response.status >= 500 && retryCount < 2) {
    const delay = JIKAN_DELAY * (retryCount + 1);
    console.log(`Jikan temporary error ${response.status}, retrying after ${delay}ms...`);
    await sleep(delay);
    return fetchJikanJson(url, retryCount + 1);
  }

  if (!response.ok) {
    const errorBody = await response.text();
    throw createJikanError(`Jikan API error ${response.status}: ${errorBody}`, response.status, errorBody);
  }

  return response.json();
}

export function getJikanListUrls(type, page, { season, year } = {}) {
  const params = new URLSearchParams({
    page: String(page),
    limit: "5",
  });

  if (type === "trending") {
    return [`${JIKAN_ENDPOINT}/top/anime?${params.toString()}&filter=bypopularity`];
  }

  if (type === "completed") {
    return [`${JIKAN_ENDPOINT}/anime?${params.toString()}&status=complete&type=tv&order_by=score&sort=desc`];
  }

  if (type === "ova") {
    return [`${JIKAN_ENDPOINT}/top/anime?${params.toString()}&type=movie`];
  }

  if (type === "airing") {
    return [`${JIKAN_ENDPOINT}/seasons/now?${params.toString()}`];
  }

  if (type === "upcoming") {
    return [`${JIKAN_ENDPOINT}/seasons/upcoming?${params.toString()}`];
  }

  if (type === "genre") {
    const jikanSeason = seasonMap[(season || "").toUpperCase()] || seasonMap.SUMMER;
    return [`${JIKAN_ENDPOINT}/seasons/${year}/${jikanSeason}?${params.toString()}`];
  }

  throw new Error(`Unsupported Jikan anime type: ${type}`);
}

export async function normalizeJikanAnime(anime, { translate = false } = {}) {
  const titleText = anime.title_japanese || anime.title || anime.title_english || "";
  const title = await maybeTranslate(titleText || anime.title || "", translate);
  const score = anime.score ? Math.round(anime.score * 10) : 0;
  const studio = anime.studios?.map((item) => item.name).filter(Boolean) || [];

  return {
    _id: anime.mal_id,
    idMal: anime.mal_id,
    title,
    originalTitle: {
      romaji: anime.title || "",
      english: anime.title_english || "",
      native: anime.title_japanese || "",
    },
    description: anime.synopsis || "",
    image: {
      large: anime.images?.jpg?.large_image_url || anime.images?.jpg?.image_url || "",
      extraLarge: anime.images?.webp?.large_image_url || anime.images?.jpg?.large_image_url || "",
      banner: anime.images?.jpg?.large_image_url || anime.images?.jpg?.image_url || "",
    },
    bannerImage: anime.images?.jpg?.large_image_url || "",
    status: anime.status || "",
    genres: normalizeGenres(anime.genres),
    episodes: anime.episodes || 0,
    type: normalizeFormat(anime.type),
    seasonYear: anime.year || anime.aired?.prop?.from?.year || null,
    season: normalizeSeason(anime.season),
    startDate: getStartDate(anime),
    studio: studio.length ? studio : ["미정"],
    days: dayMap[anime.broadcast?.day] || "",
    averageScore: score,
    popularity: anime.members || anime.popularity || 0,
    trailer: getTrailer(anime.trailer),
    nextAiringEpisode: null,
    updatedAt: null,
    lastSyncedAt: new Date(),
  };
}

export async function fetchJikanDetail(id) {
  const detailJson = await fetchJikanJson(`${JIKAN_ENDPOINT}/anime/${id}/full`);
  const charactersJson = await fetchJikanJson(`${JIKAN_ENDPOINT}/anime/${id}/characters`).catch(() => ({ data: [] }));

  const result = await normalizeJikanAnime(detailJson.data, { translate: true });
  const description = detailJson.data?.synopsis || "";

  result.description = description ? await maybeTranslate(description, true) : "줄거리 정보 없음";
  result.characters = await Promise.all(
    (charactersJson.data || []).slice(0, 6).map(async ({ character, role }) => ({
      role,
      name: {
        full: character?.name || "",
        native: character?.name ? await maybeTranslate(character.name, true) : null,
      },
      image: {
        large: character?.images?.jpg?.image_url || null,
      },
    })),
  );

  return result;
}
