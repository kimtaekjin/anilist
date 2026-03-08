export const queries = {
  trending: `
  query {
    Page(perPage: 50) {
      media(type: ANIME, format: TV, sort: POPULARITY_DESC) {
        id
        title { native }
        coverImage { large }
        format
        status
        averageScore
        popularity
        episodes
        nextAiringEpisode { episode }
      }
    }
  }
`,

  completed: `
    query {
      Page(perPage: 50) {
        media(type: ANIME, format: TV, sort: TRENDING_DESC, status: FINISHED) {
          id
          title { native }
          coverImage { large }
          format
          status
          averageScore
          episodes
          popularity
        }
      }
    }`,

  ova: `
    query {
      Page(perPage: 50) {
        media(type: ANIME, format_in: [OVA, MOVIE], sort: POPULARITY_DESC) {
          id
          title { native }
          coverImage { large }
          format
          status
          averageScore
          popularity
        }
      }
    }`,

  detail: `
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
        startDate {
          year
          month
          day
        }
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
                native
              }
              image {
                large
              }
            }
          }
        }
      }
    }
  `,
  airing: `
     query AiringAnime($season: MediaSeason, $year: Int, $page: Int) {
      Page(perPage: 50, page: $page) {
        pageInfo {
          hasNextPage
        }
        media(
          type: ANIME
          status: RELEASING
          season: $season
          seasonYear: $year
        ) {
          id
          title { native }
          coverImage { large }
          season
          seasonYear
          airingSchedule(perPage: 1, notYetAired: false) {
            nodes { airingAt }
          }
        }
      }
    }
  `,
  genre: `
  query AiringAnime($season: MediaSeason, $year: Int, $page: Int) {
      Page(perPage: 50, page: $page) {
        pageInfo {
          hasNextPage
        }
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
  `,
  upcomming: `
            query {
            Page(perPage: 50) {
              pageInfo {
                hasNextPage
              }
              media(type: ANIME, status: NOT_YET_RELEASED, sort: POPULARITY_DESC) {
                id
                title {
                  romaji
                  english
                  native
                }
                coverImage {
                  large
                }
                genres
                startDate {
                  year
                  month
                  day
                }
                studios(isMain: true) {
                  nodes {
                    name
                  }
                }
              }
            }
          }
        `,
};
