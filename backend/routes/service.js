import express from "express";
import { traslateItem } from "../components/translateItem.js";
import { queries } from "../components/animeQuery.js";
import Anime from "../models/anime.js";

const router = express.Router();

router.use(express.json());

const ANILIST_ENDPOINT = "https://graphql.anilist.co";

const seasonToQuarter = {
  WINTER: "1분기",
  SPRING: "2분기",
  SUMMER: "3분기",
  FALL: "4분기",
};

const getDay = (unix) => {
  if (!unix) return null;
  const date = new Date((unix + 9 * 3600) * 1000);
  return ["일", "월", "화", "수", "목", "금", "토"][date.getDay()];
};

const MAX_CONCURRENT_TRANSLATIONS = 5; // 동시에 처리할 번역 갯수 제한
const MAX_CONCURRENT_DB_UPDATES = 5; // 동시에 처리할 DB 업데이트 갯수 제한

async function fetchAnime(query, type, body = {}) {
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const REQUEST_DELAY = 500;

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const defaultSeason = month <= 3 ? "WINTER" : month <= 6 ? "SPRING" : month <= 9 ? "SUMMER" : "FALL";

  let page = 1;
  let hasNextPage = true;
  const allMedia = [];

  const variables = {
    season: (body.season || defaultSeason).toUpperCase(),
    seasonYear: body.year || year,
    page,
  };

  //  모든 페이지 순차적으로 가져오기
  while (hasNextPage) {
    try {
      const response = await fetch(ANILIST_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, variables }),
      });

      const json = await response.json();
      const pageData = json.data?.Page;
      console.log("데이터확인:", json.data.Page.media);

      if (!pageData) {
        console.error("AniList response error:", json);
        break;
      }

      allMedia.push(...(pageData.media || []));
      hasNextPage = pageData.pageInfo.hasNextPage;
      variables.page++; // 다음 페이지
      if (hasNextPage) await sleep(REQUEST_DELAY);
    } catch (err) {
      console.error("AniList fetch error:", err);
      break;
    }
  }

  //  trending 필터 적용
  const filteredMedia = allMedia.filter((anime) => {
    if (type === "trending") return anime.averageScore >= 70 && anime.popularity >= 80000;
    return true;
  });

  //  데이터 매핑 및 번역 (concurrency 제한)
  async function processAnime(anime) {
    const airingAt = anime.airingSchedule?.nodes?.[0]?.airingAt;
    const currentEpisode =
      anime.nextAiringEpisode?.episode !== undefined ? anime.nextAiringEpisode.episode - 1 : anime.episodes;

    // 장르 번역 제한
    const genres = anime.genres ? await limitConcurrency(anime.genres, MAX_CONCURRENT_TRANSLATIONS, traslateItem) : [];

    // 타이틀 번역
    const title = anime.title?.native ? await traslateItem(anime.title.native) : anime.title?.romaji || "";

    return {
      _id: anime.id,
      title,
      image: anime.coverImage || { large: "", extraLarge: "" },
      status: anime.status || "",
      genres,
      episodes: currentEpisode || "",
      type: anime.format || "",
      seasonYear: anime.seasonYear || "",
      startDate: {
        year: anime.startDate?.year || "",
        month: anime.startDate?.month || "",
        day: anime.startDate?.day || "",
      },
      studio: anime.studios?.nodes?.[0]?.name || "미정",
      season: seasonToQuarter[anime.season] || "",
      days: airingAt ? getDay(airingAt) : null,
      lastSyncedAt: new Date(),
    };
  }

  // 4️⃣ concurrency 제한 함수
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

  const media = await limitConcurrency(filteredMedia, MAX_CONCURRENT_TRANSLATIONS, processAnime);

  // 5️⃣ DB 업데이트도 concurrency 제한
  await limitConcurrency(media, MAX_CONCURRENT_DB_UPDATES, async (anime) => {
    return Anime.updateOne({ _id: anime._id }, { $set: anime, $addToSet: { contentTypes: type } }, { upsert: true });
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
        contentTypes: type,
        contentTypes: { $nin: ["trending", "ova"] },
        // contentTypes: { $not: { $elemMatch: { $eq: "trending" } }, // trending 타입 제외하기
      });
    } else if (type == "genre") {
      data = await Anime.find({ contentTypes: type, "startDate.year": year, season });
    } else {
      data = await Anime.find({ contentTypes: type });
    }

    const isStale = data.length == 0 || data.some((a) => now - a.lastSyncedAt > cacheDuration);

    // if (data.length == 0 || isStale) {
    const media = await fetchAnime(queries[type], type, body);
    data = media;
    // }

    res.json(data);
  } catch (err) {
    console.error("에러:", err);
    res.status(500).json({ error: "Failed to fetch anime data" });
  }
});

export default router;
