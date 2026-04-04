import express from "express";
import { traslateItem } from "../components/translateItem.js";
import { queries } from "../components/animeQuery.js";
import { fetchAnime } from "../components/fetchAnime.js";
import Anime from "../models/anime.js";

const router = express.Router();

router.use(express.json());

const ANILIST_ENDPOINT = "https://graphql.anilist.co";

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
  // console.log(data.Page.pageInfo);

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
      data = await Anime.find({ contentTypes: { $in: [type] } });
    }

    const isStale =
      data.length === 0 ||
      data.some((a) => {
        if (!a.lastSyncedAt) return true;
        const lastSyncedTime = new Date(a.lastSyncedAt).getTime();
        if (isNaN(lastSyncedTime)) return true;
        const diff = now.getTime() - lastSyncedTime;
        return diff > cacheDuration;
      });

    if (isStale) {
      // const media = await fetchAnime(queries[type], type, body);
      // data = media;
      res.json(data);
    }

    // console.log("이쪽:", data);

    res.json(data);
  } catch (err) {
    console.error("에러:", err);
    res.status(500).json({ error: "Failed to fetch anime data" });
  }
});

export default router;
