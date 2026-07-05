import Anime from "../models/anime.js";
import { fetchJikanJson, getJikanListUrls, normalizeJikanAnime } from "./jikanAdapter.js";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const MAX_CONCURRENT_DB_UPDATES = 30;
const REQUEST_DELAY = 2500;
const SINGLE_BATCH_TYPES = ["trending", "completed", "ova"];
const MAX_PAGES = 1;

export async function fetchAnime(_query, type, body = {}) {
  const now = new Date();
  const year = body.year || now.getFullYear();
  const month = now.getMonth() + 1;
  const defaultSeason = month <= 3 ? "WINTER" : month <= 6 ? "SPRING" : month <= 9 ? "SUMMER" : "FALL";
  const season = (body.season || defaultSeason).toUpperCase();

  let page = 1;
  let hasNextPage = true;
  const allMedia = [];

  while (hasNextPage && page <= MAX_PAGES) {
    const urls = getJikanListUrls(type, page, { season, year });
    const results = [];

    for (const url of urls) {
      const json = await fetchJikanJson(url);
      results.push(json);
      await sleep(REQUEST_DELAY);
    }

    for (const result of results) {
      if (Array.isArray(result.data)) {
        allMedia.push(...result.data);
      }
    }

    if (SINGLE_BATCH_TYPES.includes(type)) {
      break;
    }

    hasNextPage = results.some((result) => result.pagination?.has_next_page);
    page += 1;
  }

  const uniqueMedia = Array.from(new Map(allMedia.map((anime) => [anime.mal_id, anime])).values());

  const filteredMedia = uniqueMedia.filter((anime) => {
    if (type === "trending") return (anime.score || 0) >= 7 && (anime.members || 0) >= 80000;
    return true;
  });

  const media = [];
  for (const anime of filteredMedia) {
    media.push(await normalizeJikanAnime(anime));
  }

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
