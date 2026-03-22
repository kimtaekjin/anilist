import express from "express";
import { traslateItem } from "../components/translateItem.js";
import { queries } from "../components/animeQuery.js";
import Anime from "../models/anime.js";

const router = express.Router();

router.use(express.json());

const ANILIST_ENDPOINT = "https://graphql.anilist.co";

function getDay(airingAt) {
  const date = new Date(airingAt * 1000);
  const days = ["일", "월", "화", "수", "목", "금", "토"];
  return days[date.getDay()];
}

const MAX_CONCURRENT_TRANSLATIONS = 10;
const MAX_CONCURRENT_DB_UPDATES = 30;
const MAX_PAGE_CONCURRENCY = 3;
const SINGLE_BATCH_TYPES = ["trending", "completed", "ova"];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const REQUEST_DELAY = 500;

async function limitConcurrency(items, limit, asyncFn) {
  const results = [];
  const queue = [...items];

  const workers = Array.from({ length: limit }, async () => {
    while (queue.length) {
      const item = queue.shift();
      results.push(await asyncFn(item));
    }
  });

  await Promise.all(workers);
  return results;
}

async function fetchAnime(query, type, body = {}) {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const defaultSeason = month <= 3 ? "WINTER" : month <= 6 ? "SPRING" : month <= 9 ? "SUMMER" : "FALL";

  let page = 1;
  let hasNextPage = true;
  const allMedia = [];

  const variables = {
    season: (body.season || defaultSeason).toUpperCase(),
    year: body.year || year,
  };

  async function fetchPage(page, retryCount = 0) {
    try {
      const response = await fetch(ANILIST_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query,
          variables: { ...variables, page },
        }),
      });
      const json = await response.json();

      // 429 체크를 pageData 추출 전에 먼저 수행
      if (json.errors?.some((e) => e.status === 429)) {
        if (retryCount < 5) {
          const delay = 2000 * (retryCount + 1); // 점진적 백오프
          console.log(`Rate limited, retrying page ${page} after ${delay}ms... (attempt ${retryCount + 1})`);
          await sleep(delay);
          return fetchPage(page, retryCount + 1);
        } else {
          console.error(`Page ${page} failed after 5 retries`);
          return null;
        }
      }

      const pageData = json.data?.Page;

      if (!pageData) {
        console.error("AniList response error:", json);
        return null;
      }

      console.log(`[${type}] page: ${page}, hasNextPage: ${pageData.pageInfo?.hasNextPage}`);

      return pageData;
    } catch (error) {
      console.error("fetch error", error);
      return null;
    }
  }

  // 모든 페이지 순차적으로 가져오기
  while (hasNextPage) {
    const pages = [];
    for (let i = 0; i < MAX_PAGE_CONCURRENCY; i++) {
      pages.push(page++);
    }

    const results = await Promise.all(pages.map(fetchPage));

    // trending / completed / ova 는 첫 배치만 가져오고 종료
    if (SINGLE_BATCH_TYPES.includes(type)) {
      for (const pageData of results) {
        if (pageData) allMedia.push(...pageData.media);
      }
      break;
    }

    for (const pageData of results) {
      if (!pageData) continue;
      allMedia.push(...pageData.media);
    }

    // 마지막으로 유효한 pageData의 hasNextPage 기준으로 판단
    const lastValidResult = [...results].reverse().find(Boolean);
    hasNextPage = lastValidResult?.pageInfo?.hasNextPage ?? false;

    await sleep(REQUEST_DELAY);
  }

  // anime.id 기준으로 중복 제거 (anime._id는 DB 저장 후 생기는 필드)
  const uniqueMedia = Array.from(new Map(allMedia.map((anime) => [anime.id, anime])).values());

  // trending 필터 적용
  const filteredMedia = uniqueMedia.filter((anime) => {
    if (type === "trending") return anime.averageScore >= 70 && anime.popularity >= 80000;
    return true;
  });

  async function processAnime(anime) {
    const airingAt = anime.nextAiringEpisode?.airingAt;
    const currentEpisode =
      anime.nextAiringEpisode?.episode !== undefined ? anime.nextAiringEpisode.episode - 1 : anime.episodes || null;

    // 번역 실패 시 fallback 처리
    const genres = anime.genres
      ? await limitConcurrency(anime.genres, MAX_CONCURRENT_TRANSLATIONS, (genre) =>
          traslateItem(genre).catch(() => genre),
        )
      : [];

    const title = anime.title?.native
      ? await traslateItem(anime.title.native).catch(() => anime.title?.romaji || "")
      : anime.title?.romaji || "";

    return {
      _id: anime.id,
      title,
      image: {
        large: anime.coverImage?.large || "",
        extraLarge: anime.coverImage?.extraLarge || "",
        banner: anime.bannerImage || "",
      },
      bannerImage: anime.bannerImage || "",
      status: anime.status || "",
      genres,
      episodes: currentEpisode || 0,
      type: anime.format || "",
      seasonYear: anime.seasonYear || null,
      season: anime.season || "",
      startDate: {
        year: anime.startDate?.year || null,
        month: anime.startDate?.month || null,
        day: anime.startDate?.day || null,
      },
      studio: anime.studios?.nodes?.map((s) => s.name) || ["미정"],
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
        { upsert: true },
      );
    } catch (error) {
      console.error(`DB update failed for anime _id: ${anime._id}`, error);
    }
  });

  return media;
}
async function fetchDetail(query, type, id) {
  const response = await fetch(ANILIST_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query,
      variables: { id: Number(id) },
    }),
  });

  if (!response.ok) {
    throw new Error("AniList API 요청 실패");
  }

  const res = await response.json();
  const data = res?.data?.Media;
  console.log(data);

  if (!data) {
    throw new Error("AniList 데이터 없음");
  }

  // HTML 제거
  const cleanDescription = data.description ? data.description.replace(/<[^>]*>/g, "").trim() : "";

  // 제목 번역용 텍스트
  const titleText = data.title?.native || data.title?.romaji || data.title?.english || "";

  // 병렬 번역
  const [translatedTitle, translatedDescription, translatedGenres] = await Promise.all([
    titleText ? traslateItem(titleText) : "",
    cleanDescription ? traslateItem(cleanDescription) : "줄거리 정보 없음",
    data.genres ? Promise.all(data.genres.map((g) => traslateItem(g))) : [],
  ]);

  // 캐릭터 번역
  const characters = data.characters?.edges
    ? await Promise.all(
        data.characters.edges.map(async (edge) => ({
          role: edge.role,
          name: {
            full: edge.node.name.full,
            native: edge.node.name.native ? await traslateItem(edge.node.name.native) : null,
          },
          image: {
            large: edge.node.image?.large || null,
          },
        })),
      )
    : [];

  if (data.status == "NOT_YET_RELEASED") {
    data.episodes = ""; //방영 예정인데 에피소드가 들어가 있는 데이터가 있다 이유 아직 모름
  }

  const result = {
    _id: data.id,
    idMal: data.idMal || null,

    title: translatedTitle,

    description: translatedDescription,

    genres: translatedGenres,

    episodes: data.episodes || null,
    status: data.status || "",
    averageScore: data.averageScore || 0,
    popularity: data.popularity || 0,

    season: data.season || "",
    seasonYear: data.seasonYear || "",

    startDate: {
      year: data.startDate?.year || "",
      month: data.startDate?.month || "",
      day: data.startDate?.day || "",
    },

    image: {
      large: data.coverImage?.large || "",
      extraLarge: data.coverImage?.extraLarge || "",
      banner: data.bannerImage || "",
    },

    studio: data.studios?.edges?.[0]?.node?.name || "미정",

    trailer: data.trailer || null,

    characters,

    lastSyncedAt: new Date(),
  };

  await Anime.updateOne(
    { _id: result._id },
    {
      $set: result,
      $addToSet: { contentTypes: type },
    },
    { upsert: true },
  );

  return result;
}

router.get("/anime/detail/:id", async (req, res) => {
  const animeId = req.params.id;
  const { type } = req.query;
  let media;

  try {
    const cacheDuration = 24 * 60 * 60 * 1000;
    const now = new Date();

    media = await Anime.find({ _id: animeId, contentTypes: type });
    const isStale = media.length == 0 || media.some((a) => now - a.lastSyncedAt > cacheDuration);

    if (media.length == 0 || isStale) {
      media = await fetchDetail(queries[type], type, animeId);
    }

    return res.status(200).json(media);
  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: "서버 내부 오류가 발생했습니다." });
  }
});

router.get("/anime/:type", async (req, res) => {
  const { type } = req.params;
  const { season, year } = req.query;
  console.log("catch:", type);

  const body = {
    season,
    year,
  };

  if (!["trending", "completed", "ova", "airing", "genre", "upcomming"].includes(type)) {
    console.log("invalid type::", type);
    return res.status(400).json({ error: "Invalid type" });
  }

  try {
    const cacheDuration = 24 * 60 * 60 * 1000;
    const now = new Date();

    let data;

    if (type == "completed") {
      data = await Anime.find({
        $and: [{ contentTypes: type }, { contentTypes: { $nin: ["trending", "ova"] } }],
      });
    } else if (type == "genre") {
      data = await Anime.find({ contentTypes: type, "startDate.year": year, season });
    } else if (type == "airing") {
      data = await Anime.find({ contentTypes: type, status: "RELEASING" });
    } else {
      data = await Anime.find({ contentTypes: type });
    }

    const isStale = data.length == 0 || data.some((a) => now - a.lastSyncedAt > cacheDuration);

    if (data.length === 0 || isStale) {
      const media = await fetchAnime(queries[type], type, body);
      data = media;
    }

    // console.log("이쪽:", data);

    res.json(data);
  } catch (err) {
    console.error("에러:", err);
    res.status(500).json({ error: "Failed to fetch anime data" });
  }
});

export default router;
