import { translateText } from "./translate";

export const fetchTrendingAnime = async () => {
  const query = `
    query {
      Page(perPage: 50) {
        media(type: ANIME, format: TV, sort: POPULARITY_DESC) {
          id
          title { romaji english native }
          coverImage { large }
          format
          status
          averageScore
          popularity
          episodes
          nextAiringEpisode { episode }
        }
      }
    }`;
  const res = await fetch("https://graphql.anilist.co", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
  const json = await res.json();
  console.log(json);

  const trending = [];
  let currentEpisode = 0;
  for (let anime of json.data.Page.media) {
    if (anime.averageScore >= 70 && anime.popularity >= 80000) {
      if (anime.nextAiringEpisode) {
        currentEpisode = anime.nextAiringEpisode.episode - 1;
      } else {
        currentEpisode = anime.episodes;
      }

      trending.push({
        id: anime.id,
        title: translateText(anime.title.native),
        image: anime.coverImage?.large,
        status: anime.status,
        episodes: currentEpisode,
        type: anime.format,
      });
    }
  }
  return trending.slice(0, 30);
};

export const fetchCompletedAnime = async () => {
  const query = `
        query {
          Page(perPage: 50) {
            media(type: ANIME, format: TV, sort: POPULARITY_DESC, status: FINISHED) {
              id
              title { romaji english native }
              coverImage { large }
              format
              status
              averageScore
              episodes
              popularity
            }
          }
        }`;
  const res = await fetch("https://graphql.anilist.co", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
  const json = await res.json();

  const completed = json.data.Page.media.map((anime) => ({
    id: anime.id,
    title: translateText(anime.title.native),
    image: anime.coverImage?.large,
    episodes: anime.episodes,
    status: anime.status,
    type: anime.format,
  }));

  return completed;
};

export const fetchOVAAnime = async () => {
  const query = `
        query {
          Page(perPage: 50) {
            media(type: ANIME, format_in: [OVA, MOVIE], sort: POPULARITY_DESC) {
              id
              title { romaji english native }
              coverImage { large }
              format
              status
              averageScore
              popularity
            }
          }
        }`;
  const res = await fetch("https://graphql.anilist.co", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
  const json = await res.json();

  const ovaList = [];
  for (let anime of json.data.Page.media) {
    ovaList.push({
      id: anime.id,
      title: translateText(anime.title.native),
      image: anime.coverImage?.large,
      status: anime.status,
      type: anime.format,
    });
  }
  return ovaList;
};

export const fetchAiringAnime = async () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  const seasonToQuarter = {
    WINTER: "1분기",
    SPRING: "2분기",
    SUMMER: "3분기",
    FALL: "4분기",
  };

  const getDay = (time) => {
    if (!time) return null;
    return ["일", "월", "화", "수", "목", "금", "토"][new Date(time * 1000).getDay()];
  };

  const season = month <= 3 ? "WINTER" : month <= 6 ? "SPRING" : month <= 9 ? "SUMMER" : "FALL";

  const ANILIST_QUERY = `
    query AiringAnime($season: MediaSeason, $year: Int, $page: Int) {
      Page(perPage: 50, page: $page) {
        pageInfo {
          currentPage
          lastPage
          hasNextPage
        }
        media(
          type: ANIME
          status: RELEASING
          season: $season
          seasonYear: $year
        ) {
          id
          title {
            romaji
            english
            native
          }
          coverImage {
            large
          }
          season
          seasonYear
          airingSchedule(notYetAired: false, perPage: 1) {
            nodes {
              airingAt
            }
          }
        }
      }
    }
  `;

  let page = 1;
  let allMedia = [];
  let hasNextPage = true;

  while (hasNextPage) {
    const res = await fetch("https://graphql.anilist.co", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: ANILIST_QUERY,
        variables: { season, year, page },
      }),
    });

    const json = await res.json();
    const { media, pageInfo } = json.data.Page;

    allMedia = allMedia.concat(media);

    hasNextPage = pageInfo.hasNextPage;
    page++;
  }

  const processed = allMedia.map((anime) => {
    const airingAt = anime.airingSchedule.nodes[0]?.airingAt;
    return {
      id: anime.id,
      title: anime.title.native ? translateText(anime.title.native) : [],
      image: anime.coverImage.large,
      year: anime.seasonYear,
      quarter: seasonToQuarter[anime.season],
      day: getDay(airingAt),
    };
  });

  return processed;
};

export const fetchGenreAnime = async (selectedSeason, selectedYear) => {
  const ANILIST_QUERY = `
    query SeasonAnime($season: MediaSeason, $year: Int) {
      Page(perPage: 100) {
        media(
          type: ANIME
          season: $season
          seasonYear: $year
          sort: POPULARITY_DESC
        ) {
          id
          title {
            romaji
            english
            native
          }
          coverImage {
            large
          }
          startDate {
            year
          }
          studios {
            nodes {
              name
            }
          }
          genres
        }
      }
    }
  `;

  const res = await fetch("https://graphql.anilist.co", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query: ANILIST_QUERY,
      variables: {
        season: selectedSeason,
        year: selectedYear,
      },
    }),
  });

  const json = await res.json();

  // 🔥 GraphQL 에러 방어
  if (json.errors) {
    console.error("GraphQL errors:", json.errors);
    return [];
  }

  if (!json.data?.Page?.media) {
    return [];
  }

  const processed = await Promise.all(
    json.data.Page.media.map(async (anime) => ({
      id: anime.id,
      title: anime.title.native ? await translateText(anime.title.native) : anime.title.english || anime.title.romaji,
      image: anime.coverImage.large,
      genre: anime.genres ? await Promise.all(anime.genres.map((g) => translateText(g))) : [],
      startYear: anime.startDate?.year || "미정",
      studio: anime.studios.nodes[0]?.name || "미정",
    }))
  );

  return processed;
};

export const fetchDetailAnime = async (id) => {
  const query = `
    query ($id: Int!) {
      Media(id: $id, type: ANIME) {
        id
        idMal
        title {
          romaji
          english
          native
        }
        description
        coverImage {
          extraLarge
          large
        }
        bannerImage
        genres
        season
        seasonYear
        episodes
        status
        averageScore
        popularity
        studios {
          edges {
            node {
              name
            }
          }
        }
        nextAiringEpisode {
          episode
          airingAt
        }
        trailer {
          id
          site
        }
        characters(sort: ROLE, perPage: 6) {
          edges {
            role
            node {
              name {
                full
              }
              image {
                large
              }
            }
          }
        }
      }
    }
  `;

  const res = await fetch("https://graphql.anilist.co", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query,
      variables: { id: Number(id) },
    }),
  });

  const json = await res.json();
  const data = json.data.Media;

  const translatedData = {
    ...data,
    title: data.title.native
      ? await translateText(data.title.native)
      : data.title.romaji || data.title.english || "제목 없음",
    description: data.description ? await translateText(data.description) : "줄거리 정보 없음",
    genres: data.genres ? await Promise.all(data.genres.map((g) => translateText(g))) : [],
    characters: data.characters?.edges
      ? await Promise.all(
          data.characters.edges.map(async (edge) => ({
            role: edge.role,
            name: edge.node.name.full ? await translateText(edge.node.name.full) : "이름 없음",
            image: edge.node.image?.large ?? "/default-character.jpg",
          }))
        )
      : [],
  };
  return translatedData;
};
