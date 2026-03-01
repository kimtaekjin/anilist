//추천애니
export const trendingQuery = `
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
`;

//완결애니
export const completedQuery = `
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
    }`;

//ova 및 극장애니
export const ovaQuery = `
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
    }`;

//방영애니
export const airingQuery = `
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
  `;
//장르별애니
export const genreQuery = `
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

export const upcommingQuery = `
            query {
            Page(perPage: 50) {
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
        `;

export const detailQuery = `
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
  `;
