import { localizeGenre } from "../components/animeLocalization.js";
import { translateItem } from "../components/translateItem.js";
import Anime from "../models/anime.js";
import { requestAniList } from "./anilistClient.js";

const MAX_CONCURRENT_TRANSLATIONS = 1;
const MAX_PAGE_CONCURRENCY = 3;
const SINGLE_BATCH_TYPES = ["trending", "completed", "ova"];
const MAX_PAGE_BATCHES_BY_TYPE = {
  genre: Number(process.env.ANIME_GENRE_MAX_PAGE_BATCHES || 1),
  upcoming: Number(process.env.ANIME_UPCOMING_MAX_PAGE_BATCHES || 1),
};
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

export async function fetchAnime(query, type, body = {}, options = {}) {
  const kstNow = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const year = kstNow.getUTCFullYear();
  const month = kstNow.getUTCMonth() + 1;
  const defaultSeason = month <= 3 ? "WINTER" : month <= 6 ? "SPRING" : month <= 9 ? "SUMMER" : "FALL";

  let page = 1;
  let hasNextPage = true;
  let pageCount = 0;
  const allMedia = [];

  const variables = {
    season: (body.season || defaultSeason).toUpperCase(),
    year: body.year || year,
  };

  async function fetchPage(pageNumber) {
    try {
      const data = await requestAniList(query, { ...variables, page: pageNumber });
      const pageData = data?.Page;

      if (!pageData) {
        throw new Error("AniList response did not include Page data");
      }

      console.log(`[${type}] page: ${pageNumber}, hasNextPage: ${pageData.pageInfo?.hasNextPage}`);
      return pageData;
    } catch (error) {
      console.error(`[${type}] page ${pageNumber} fetch failed:`, error.message);
      throw error;
    }
  }

  const configuredBatchLimit = MAX_PAGE_BATCHES_BY_TYPE[type];
  const maxPages = options.fetchAllPages
    ? Number.POSITIVE_INFINITY
    : SINGLE_BATCH_TYPES.includes(type)
      ? 1
      : configuredBatchLimit
        ? configuredBatchLimit * MAX_PAGE_CONCURRENCY
        : Number.POSITIVE_INFINITY;

  while (hasNextPage && page <= maxPages) {
    const pageData = await fetchPage(page);
    pageCount += 1;
    if (pageData.media) allMedia.push(...pageData.media);

    hasNextPage = pageData.pageInfo?.hasNextPage ?? false;
    page += 1;
  }

  const uniqueMedia = Array.from(new Map(allMedia.map((anime) => [anime.id, anime])).values());

  const filteredMedia = uniqueMedia.filter((anime) => {
    if (type === "trending") return anime.averageScore >= 70 && anime.popularity >= 80000;
    return true;
  });

  const storedAnime = filteredMedia.length
    ? await Anime.find({ _id: { $in: filteredMedia.map((anime) => anime.id) } })
        .select(
          "_id title originalTitle image season seasonYear updatedAt averageScore popularity status episodes nextAiringEpisode description characters contentTypes",
        )
        .lean()
    : [];
  const storedById = new Map(storedAnime.map((anime) => [Number(anime._id), anime]));

  function hasAnimeChanged(anime) {
    const stored = storedById.get(Number(anime.id));
    if (!stored) return true;

    const storedTitleNeedsRepair =
      !stored.title || (!/[가-힣]/.test(stored.title) && /[\u3040-\u30ff\u3400-\u9fff]/.test(stored.title));
    const storedListDataIsIncomplete =
      !stored.image?.large || stored.season !== anime.season || Number(stored.seasonYear) !== Number(anime.seasonYear);
    const storedDetailDataIsIncomplete = type === "genre" && !stored.contentTypes?.includes("detail");
    const sourceTitleChanged =
      String(stored.originalTitle?.romaji || "") !== String(anime.title?.romaji || "") ||
      String(stored.originalTitle?.english || "") !== String(anime.title?.english || "") ||
      String(stored.originalTitle?.native || "") !== String(anime.title?.native || "");

    const airingAt = anime.nextAiringEpisode?.airingAt;
    const currentEpisode =
      anime.nextAiringEpisode?.episode !== undefined ? anime.nextAiringEpisode.episode - 1 : anime.episodes || 0;

    return (
      storedTitleNeedsRepair ||
      storedListDataIsIncomplete ||
      storedDetailDataIsIncomplete ||
      sourceTitleChanged ||
      Number(anime.updatedAt || 0) > Number(stored.updatedAt || 0) ||
      Number(anime.averageScore || 0) !== Number(stored.averageScore || 0) ||
      Number(anime.popularity || 0) !== Number(stored.popularity || 0) ||
      String(anime.status || "") !== String(stored.status || "") ||
      Number(currentEpisode) !== Number(stored.episodes || 0) ||
      (anime.nextAiringEpisode &&
        (Number(currentEpisode) !== Number(stored.nextAiringEpisode?.episode || 0) ||
          Number(airingAt || 0) !== Number(stored.nextAiringEpisode?.airingAt || 0)))
    );
  }

  const changedMedia = [];
  const unchangedIds = [];

  for (const anime of filteredMedia) {
    if (hasAnimeChanged(anime)) changedMedia.push(anime);
    else unchangedIds.push(anime.id);
  }

  async function processAnime(anime) {
    const airingAt = anime.nextAiringEpisode?.airingAt;
    const currentEpisode =
      anime.nextAiringEpisode?.episode !== undefined ? anime.nextAiringEpisode.episode - 1 : anime.episodes || null;

    const genres = anime.genres
      ? await limitConcurrency(anime.genres, MAX_CONCURRENT_TRANSLATIONS, localizeGenre)
      : [];

    const sourceTitle = anime.title?.native || anime.title?.romaji || anime.title?.english || "";
    const fallbackTitle = anime.title?.english || anime.title?.romaji || anime.title?.native || "";
    const stored = storedById.get(Number(anime.id));
    const storedTitle = stored?.title || "";
    const sourceTitleChanged =
      String(stored?.originalTitle?.romaji || "") !== String(anime.title?.romaji || "") ||
      String(stored?.originalTitle?.english || "") !== String(anime.title?.english || "") ||
      String(stored?.originalTitle?.native || "") !== String(anime.title?.native || "");
    const translatedTitle =
      /[가-힣]/.test(storedTitle) && !sourceTitleChanged
        ? storedTitle
        : anime.title?.native
          ? await translateItem(anime.title.native).catch(() => fallbackTitle)
          : fallbackTitle;
    const title = /[가-힣]/.test(translatedTitle)
      ? translatedTitle
      : /[가-힣]/.test(storedTitle)
        ? storedTitle
        : fallbackTitle || sourceTitle;

    const cleanDescription = anime.description ? anime.description.replace(/<[^>]*>/g, "").trim() : "";
    const description = cleanDescription
      ? await translateItem(cleanDescription).catch(() => cleanDescription)
      : "줄거리 정보 없음";
    const characters = anime.characters?.edges
      ? await limitConcurrency(anime.characters.edges, MAX_CONCURRENT_TRANSLATIONS, async (edge) => ({
          role: edge.role,
          name: {
            full: edge.node?.name?.full || "",
            native: edge.node?.name?.native
              ? await translateItem(edge.node.name.native).catch(() => edge.node.name.native)
              : null,
          },
          image: { large: edge.node?.image?.large || null },
        }))
      : [];

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
      ...(anime.description !== undefined
        ? { description, trailer: anime.trailer || null, characters }
        : {}),
      updatedAt: anime.updatedAt || null,
      lastCheckedAt: new Date(),
      lastSyncedAt: new Date(),
    };
  }

  const media = await limitConcurrency(changedMedia, MAX_CONCURRENT_TRANSLATIONS, processAnime);

  if (unchangedIds.length) {
    const unchangedUpdate = {
      $addToSet: {
        contentTypes: type === "genre" ? { $each: ["genre", "detail"] } : type,
      },
      $set: { lastCheckedAt: new Date() },
    };
    if (type === "genre") unchangedUpdate.$set.isCatalogActive = true;

    await Anime.updateMany(
      { _id: { $in: unchangedIds } },
      unchangedUpdate,
    );
  }

  if (media.length) {
    try {
      await Anime.bulkWrite(
        media.map((anime) => {
          if (type === "genre") anime.isCatalogActive = true;
          const { _id, ...animeFields } = anime;
          const update = {
            $set: animeFields,
            $addToSet: {
              contentTypes: type === "genre" ? { $each: ["genre", "detail"] } : type,
            },
          };

          return {
            updateOne: {
              filter: { _id },
              update,
              upsert: true,
            },
          };
        }),
        { ordered: false },
      );
    } catch (error) {
      console.error(`[${type}] bulk DB update failed:`, error);
      throw error;
    }
  }

  if (type === "genre" && options.fetchAllPages) {
    await Anime.updateMany(
      {
        season: variables.season,
        seasonYear: variables.year,
        _id: { $nin: filteredMedia.map((anime) => anime.id) },
      },
      { $set: { isCatalogActive: false } },
    );
  }

  console.log(`[${type}] 변경 ${media.length}개, 변경 없음 ${unchangedIds.length}개`);

  return {
    changedCount: media.length,
    unchangedCount: unchangedIds.length,
    fetchedCount: filteredMedia.length,
    pageCount,
  };
}



