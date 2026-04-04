const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const MAX_CONCURRENT_TRANSLATIONS = 10;
const MAX_CONCURRENT_DB_UPDATES = 30;
const MAX_PAGE_CONCURRENCY = 3;
const REQUEST_DELAY = 200;
const SINGLE_BATCH_TYPES = ["trending", "completed", "ova"];

function getDay(airingAt) {
  const date = new Date(airingAt * 1000);
  const days = ["일", "월", "화", "수", "목", "금", "토"];
  return days[date.getDay()];
}

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

export async function fetchAnime(query, type, body = {}) {
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

      console.log(json);

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
