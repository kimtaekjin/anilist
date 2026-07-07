import { localizeGenre } from "../components/animeLocalization.js";
import { translateItem } from "../components/translateItem.js";
import Anime from "../models/anime.js";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const ANILIST_ENDPOINT = "https://graphql.anilist.co";

const MAX_CONCURRENT_TRANSLATIONS = 1;
const MAX_CONCURRENT_DB_UPDATES = 30;
const MAX_PAGE_CONCURRENCY = 3;
const REQUEST_DELAY = 1000;
const SINGLE_BATCH_TYPES = ["trending", "completed", "ova"];
const MAX_PAGE_BATCHES_BY_TYPE = {
  upcoming: Number(process.env.ANIME_UPCOMING_MAX_PAGE_BATCHES || 1),
};
const STOP_SYNC_STATUSES = [401, 403];

class AniListRequestError extends Error {
  constructor(message, status) {
    super(message);
    this.name = "AniListRequestError";
    this.status = status;
  }
}

function getDay(airingAt) {
  const date = new Date(airingAt * 1000);
  const days = ["일", "월", "화", "수", "목", "금", "토"];
  return days[date.getDay()];
}

async function limitConcurrency(items, limit, asyncFn) {
  const results = [];
  const queue = [...items];

  const workers = Array.from({ length: Math.min(limit, queue.length) }, async () => {
    while (queue.length) {
      const item = queue.shift();
      results.push(await asyncFn(item));
    }
  });

  await Promise.all(workers);
  return results;
}

export async function fetchAnime(query, type, body = {}) {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const defaultSeason = month <= 3 ? "WINTER" : month <= 6 ? "SPRING" : month <= 9 ? "SUMMER" : "FALL";

  let page = 1;
  let hasNextPage = true;
  let pageBatchCount = 0;
  const allMedia = [];

  const variables = {
    season: (body.season || defaultSeason).toUpperCase(),
    year: body.year || year,
  };

  async function fetchPage(pageNumber, retryCount = 0) {
    try {
      const response = await fetch(ANILIST_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          query,
          variables: { ...variables, page: pageNumber },
        }),
      });

      const json = await response.json();
      const firstError = json.errors?.[0];
      const errorStatus = firstError?.status || response.status;

      if (json.errors?.length) {
        const message = firstError?.message || "AniList GraphQL error";

        if (errorStatus === 429 && retryCount < 5) {
          const delay = 3000 * (retryCount + 1);
          console.log(`Rate limited, retrying page ${pageNumber} after ${delay}ms...`);
          await sleep(delay);
          return fetchPage(pageNumber, retryCount + 1);
        }

        if (STOP_SYNC_STATUSES.includes(errorStatus)) {
          throw new AniListRequestError(message, errorStatus);
        }

        console.error("AniList response error:", json);
        return null;
      }

      const pageData = json.data?.Page;

      if (!pageData) {
        console.error("AniList response error:", json);
        return null;
      }

      console.log(`[${type}] page: ${pageNumber}, hasNextPage: ${pageData.pageInfo?.hasNextPage}`);
      return pageData;
    } catch (error) {
      if (error instanceof AniListRequestError) {
        throw error;
      }

      console.error("fetch error", error);
      return null;
    }
  }

  while (hasNextPage) {
    pageBatchCount += 1;

    const pageCount = SINGLE_BATCH_TYPES.includes(type) ? 1 : MAX_PAGE_CONCURRENCY;
    const pages = [];

    for (let i = 0; i < pageCount; i++) {
      pages.push(page++);
    }

    const results = await Promise.all(pages.map(fetchPage));

    for (const pageData of results) {
      if (pageData?.media) allMedia.push(...pageData.media);
    }

    if (SINGLE_BATCH_TYPES.includes(type)) {
      break;
    }

    if (MAX_PAGE_BATCHES_BY_TYPE[type] && pageBatchCount >= MAX_PAGE_BATCHES_BY_TYPE[type]) {
      break;
    }

    const lastValidResult = [...results].reverse().find(Boolean);
    hasNextPage = lastValidResult?.pageInfo?.hasNextPage ?? false;

    await sleep(REQUEST_DELAY);
  }

  const uniqueMedia = Array.from(new Map(allMedia.map((anime) => [anime.id, anime])).values());

  const filteredMedia = uniqueMedia.filter((anime) => {
    if (type === "trending") return anime.averageScore >= 70 && anime.popularity >= 80000;
    return true;
  });

  async function processAnime(anime) {
    const airingAt = anime.nextAiringEpisode?.airingAt;
    const currentEpisode =
      anime.nextAiringEpisode?.episode !== undefined ? anime.nextAiringEpisode.episode - 1 : anime.episodes || null;

    const genres = anime.genres
      ? await limitConcurrency(anime.genres, MAX_CONCURRENT_TRANSLATIONS, localizeGenre)
      : [];

    const title = anime.title?.native
      ? await translateItem(anime.title.native).catch(() => anime.title?.romaji || "")
      : anime.title?.romaji || "";

    return {
      _id: anime.id,
      idMal: anime.idMal || null,
      title,
      originalTitle: {
        romaji: anime.title?.romaji || "",
        english: anime.title?.english || "",
        native: anime.title?.native || "",
      },
      image: {
        large: anime.coverImage?.large || "",
        extraLarge: anime.coverImage?.extraLarge || "",
        banner: anime.bannerImage || "",
      },
      bannerImage: anime.bannerImage || "",
      status: anime.status || "",
      genres,
      episodes: currentEpisode || 0,
      type: anime.format || undefined,
      seasonYear: anime.seasonYear || null,
      season: anime.season || "",
      startDate: {
        year: anime.startDate?.year || null,
        month: anime.startDate?.month || null,
        day: anime.startDate?.day || null,
      },
      studio: anime.studios?.nodes?.map((s) => s.name).filter(Boolean) || ["미정"],
      days: airingAt ? getDay(airingAt) : "",
      averageScore: anime.averageScore || 0,
      popularity: anime.popularity || 0,
      nextAiringEpisode: anime.nextAiringEpisode ? { episode: currentEpisode, airingAt } : null,
      updatedAt: anime.updatedAt || null,
      lastSyncedAt: new Date(),
    };
  }

  const media = await limitConcurrency(filteredMedia, MAX_CONCURRENT_TRANSLATIONS, processAnime);

  await limitConcurrency(media, MAX_CONCURRENT_DB_UPDATES, async (anime) => {
    try {
      return await Anime.updateOne(
        { _id: anime._id },
        { $set: anime, $addToSet: { contentTypes: type } },
        { upsert: true, runValidators: true },
      );
    } catch (error) {
      console.error(`DB update failed for anime _id: ${anime._id}`, error);
    }
  });

  return media;
}



