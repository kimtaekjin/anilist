function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const animeList = async (page = "airing") => {
  let anime = [];
  let pageNum = 1;
  let hasNextPage = true;

  switch (page) {
    case "airing":
      {
        while (hasNextPage) {
          const res = await fetch(`https://api.jikan.moe/v4/seasons/now?page=${pageNum}`);
          const data = await res.json();

          if (data && Array.isArray(data.data)) {
            anime.push(...data.data);
          } else {
            console.error(`페이지 ${page}에서 data.data가 유효하지 않음`, data);
            break; // 더 이상 진행하지 않음
          }

          hasNextPage = data.pagination.has_next_page;
          pageNum++;

          await sleep(1500);
        }
      }
      break;

    case "upcoming":
      {
        const res = await fetch(`https://api.jikan.moe/v4/seasons/upcoming`);
        const json = await res.json();
        anime = json.data;
      }
      break;

    default:
      anime = [];
  }

  return anime;
};

module.exports = { animeList };
