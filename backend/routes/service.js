import express from "express";
import { traslateItem } from "../components/translateItem.js";
import {
  airingQuery,
  completedQuery,
  detailQuery,
  genreQuery,
  ovaQuery,
  trendingQuery,
  upcommingQuery,
} from "../components/animeQuery.js";
import Anime from "../models/anime.js";

const router = express.Router();

router.use(express.json());

const ANILIST_ENDPOINT = "https://graphql.anilist.co";

router.get("/anime/trending", async (req, res) => {
  const query = trendingQuery;
  try {
    const cacheDuration = 24 * 60 * 60 * 1000;
    const now = new Date();

    let data = await Anime.find({ contentTypes: "trending" });
    const isStale = data.length == 0 || data.some((a) => now - a.lastSyncedAt > cacheDuration);

    if (data.length == 0 || isStale) {
      const result = await fetch(ANILIST_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });
      const json = await result.json();

      const newTrending = await Promise.all(
        json.data.Page.media
          .filter((anime) => anime.averageScore >= 70 && anime.popularity >= 80000)
          .map(async (anime) => {
            const currentEpisode = anime.nextAiringEpisode ? anime.nextAiringEpisode.episode - 1 : anime.episodes;

            return {
              _id: anime.id,
              title: anime.title.native ? await traslateItem(anime.title.native) : [],
              image: anime.coverImage || { large: "", extraLarge: "" },
              status: anime.status,
              episodes: currentEpisode,
              type: anime.format || "",
              lastSyncedAt: new Date(),
            };
          }),
      );

      for (const anime of newTrending) {
        await Anime.updateOne(
          { _id: anime._id },
          { $set: anime, $addToSet: { contentTypes: "trending" } },
          { upsert: true },
        );
      }

      data = newTrending;
    }

    return res.status(200).json(data.slice(0, 30));
  } catch (error) {
    return res.status(500).json({ message: "서버 내부 오류가 발생했습니다." });
  }
});

router.get("/anime/completed", async (req, res) => {
  const query = completedQuery;
  try {
    const cacheDuration = 24 * 60 * 60 * 1000;
    const now = new Date();

    let data = await Anime.find({
      contentTypes: "completed",
      contentTypes: { $nin: ["trending", "ova"] },
      // contentTypes: { $not: { $elemMatch: { $eq: "trending" } }, // trending 타입 제외하기
    });
    const isStale = data.length == 0 || data.some((a) => now - a.lastSyncedAt > cacheDuration);

    if (data.length == 0 || isStale) {
      const res = await fetch(ANILIST_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });

      const json = await res.json();

      const completed = await Promise.all(
        json.data.Page.media.map(async (anime) => ({
          _id: anime.id,
          title: await traslateItem(anime.title.native),
          image: anime.coverImage || { large: "", extraLarge: "" },
          episodes: anime.episodes,
          status: anime.status,
          type: anime.format,
        })),
      );

      for (const anime of completed) {
        await Anime.updateOne(
          { _id: anime._id },
          { $set: anime, $addToSet: { contentTypes: "completed" } },
          { upsert: true },
        );
      }

      data = completed;
    }

    return res.status(200).json(data.slice(0, 30));
  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: "서버 내부 오류가 발생했습니다." });
  }
});

router.get("/anime/ova", async (req, res) => {
  const query = ovaQuery;
  try {
    const cacheDuration = 24 * 60 * 60 * 1000;
    const now = new Date();

    let data = await Anime.find({ contentTypes: "ova" });
    const isStale = data.length == 0 || data.some((a) => now - a.lastSyncedAt > cacheDuration);

    if (data.length == 0 || isStale) {
      const res = await fetch(ANILIST_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });

      const json = await res.json();

      const ovaList = await Promise.all(
        json.data.Page.media.map(async (anime) => ({
          _id: anime.id,
          title: await traslateItem(anime.title.native),
          image: anime.coverImage || { large: "", extraLarge: "" },
          status: anime.status,
          type: anime.format,
        })),
      );

      for (const anime of ovaList) {
        await Anime.updateOne(
          { _id: anime._id },
          { $set: anime, $addToSet: { contentTypes: "ova" } },
          { upsert: true },
        );
      }

      data = ovaList;
    }

    return res.status(200).json(data.slice(0, 30));
  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: "서버 내부 오류가 발생했습니다." });
  }
});

router.get("/anime/airing", async (req, res) => {
  const query = airingQuery;
  try {
    const cacheDuration = 24 * 60 * 60 * 1000;
    const now = new Date();

    let data = await Anime.find({ contentTypes: "airing" });
    const isStale = data.length == 0 || data.some((a) => now - a.lastSyncedAt > cacheDuration);

    if (data.length == 0 || isStale) {
      const now = new Date();
      const year = now.getFullYear();
      const month = now.getMonth() + 1;

      const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

      const season = month <= 3 ? "WINTER" : month <= 6 ? "SPRING" : month <= 9 ? "SUMMER" : "FALL";

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
      const REQUEST_DELAY = 1000;
      let page = 1;
      let hasNextPage = true;
      const allMedia = [];

      while (hasNextPage) {
        const res = await fetch(ANILIST_ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query,
            variables: { season, year, page },
          }),
        });

        const json = await res.json();
        const pageData = json.data.Page;

        allMedia.push(...pageData.media);
        hasNextPage = pageData.pageInfo.hasNextPage;
        page++;

        if (hasNextPage) await sleep(REQUEST_DELAY);
      }

      const airing = await Promise.all(
        allMedia.map(async (anime) => {
          const airingAt = anime.airingSchedule.nodes[0]?.airingAt;

          return {
            _id: anime.id,
            title: anime.title.native ? await traslateItem(anime.title.native) : "",
            image: anime.coverImage || { large: "", extraLarge: "" },
            seasonYear: anime.seasonYear,
            season: seasonToQuarter[anime.season],
            days: getDay(airingAt),
          };
        }),
      );

      for (const anime of airing) {
        await Anime.updateOne(
          { _id: anime._id },
          { $set: anime, $addToSet: { contentTypes: "airing" } },
          { upsert: true },
        );
      }

      data = airing;
    }

    return res.status(200).json(data);
  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: "서버 내부 오류가 발생했습니다." });
  }
});

router.get("/anime/genre", async (req, res) => {
  const { season, year } = req.query;
  const query = genreQuery;
  console.log("요청");

  try {
    const cacheDuration = 24 * 60 * 60 * 1000;
    const now = new Date();

    let data = await Anime.find({ contentTypes: "genre" });
    const isStale = data.length == 0 || data.some((a) => now - a.lastSyncedAt > cacheDuration);

    if (data.length == 0 || isStale) {
      const response = await fetch("https://graphql.anilist.co", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query,
          variables: {
            season,
            year,
          },
        }),
      });

      const json = await response.json();

      const processed = await Promise.all(
        json.data.Page.media.map(async (anime) => ({
          _id: anime.id,
          title: anime.title.native ? await traslateItem(anime.title.native) : "",
          image: anime.coverImage || { large: "", extraLarge: "" },
          genres: anime.genres ? await Promise.all(anime.genres.map((g) => traslateItem(g))) : [],
          startDate: {
            year: anime.startDate?.year || "",
          },
          studio: anime.studios.nodes[0]?.name || "미정",
        })),
      );

      for (const anime of processed) {
        await Anime.updateOne(
          { _id: anime._id },
          { $set: anime, $addToSet: { contentTypes: "genre" } },
          { upsert: true },
        );
      }

      data = processed;
    }

    return res.status(200).json(data);
  } catch (error) {
    console.log("에러발생:", error);
    return res.status(500).json({ message: "서버 내부 오류가 발생했습니다." });
  }
});

router.get("/anime/upcomming", async (req, res) => {
  const query = upcommingQuery;
  try {
    const cacheDuration = 24 * 60 * 60 * 1000;
    const now = new Date();

    let data = await Anime.find({ contentTypes: "upcomming" });
    const isStale = data.length == 0 || data.some((a) => now - a.lastSyncedAt > cacheDuration);

    if (data.length == 0 || isStale) {
      const response = await fetch("https://graphql.anilist.co", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });

      const json = await response.json();

      const upcomming = await Promise.all(
        json.data.Page.media.map(async (anime) => {
          const { year, month, day } = anime.startDate;

          return {
            _id: anime.id,
            title: anime.title.native ? await traslateItem(anime.title.native) : anime.title.english,
            image: anime.coverImage || { large: "", extraLarge: "" },
            genres: anime.genres ? await Promise.all(anime.genres.map((g) => traslateItem(g))) : [],
            startDate: {
              year,
              month,
              day,
            },
            studio: anime.studios.nodes[0]?.name || "미정",
          };
        }),
      );
      for (const anime of upcomming) {
        await Anime.updateOne(
          { _id: anime._id },
          { $set: anime, $addToSet: { contentTypes: "upcomming" } },
          { upsert: true },
        );
      }

      data = upcomming;
    }

    return res.status(200).json(data);
  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: "서버 내부 오류가 발생했습니다." });
  }
});

router.get("/anime/detail", async (req, res) => {
  const query = detailQuery;
  const id = req.query.id;

  try {
    const cacheDuration = 24 * 60 * 60 * 1000;
    const now = new Date();

    let datail = await Anime.find({ _id: id });
    const isStale = datail.length == 0 || datail.some((a) => now - a.lastSyncedAt > cacheDuration);

    // if (datail.length == 0 || isStale) {
    const response = await fetch("https://graphql.anilist.co", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query,
        variables: { id: Number(id) },
      }),
    });

    const json = await response.json();
    const data = json.data.Media;
    console.log(data);

    const noneHtmlDescription = data.description.replace(/<[^>]*>/g, "").trim();
    const { year, month, day } = data.startDate;

    const translatedData = {
      ...data,
      title: data.title.native
        ? await traslateItem(data.title.native)
        : data.title.romaji || data.title.english || "제목 없음",
      description: data.description ? await traslateItem(noneHtmlDescription) : "줄거리 정보 없음",
      genres: data.genres ? await Promise.all(data.genres.map((g) => traslateItem(g))) : [],
      characters: data.characters?.edges
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
        : [],
      startdate: {
        year,
        month,
        day,
      },
      image: {
        extraLarge: data.coverImage.extraLarge,
        large: data.coverImage.large,
      },
    };

    await Anime.updateOne({ _id: translatedData._id }, { $set: translatedData }, { upsert: true });

    datail = translatedData;
    // }

    return res.status(200).json(datail);
  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: "서버 내부 오류가 발생했습니다." });
  }
});

export default router;
