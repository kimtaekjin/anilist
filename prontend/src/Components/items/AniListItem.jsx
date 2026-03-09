import axios from "axios";

const API_URL = process.env.REACT_APP_CLIENT_URL;

export const fetchAniList = async (type, selectedSeason, selectedYear) => {
  const body = {
    season: selectedSeason,
    year: selectedYear,
  };
  try {
    let response = await axios.get(`${API_URL}/service/anime/${type}`, {
      params: body,
    });

    response.data.map((e) => {
      if (e.startDate) {
        const year = e.startDate.year ?? "";
        const month = e.startDate.month ? String(e.startDate.month).padStart(2, "0") : "";
        const day = e.startDate.day ? String(e.startDate.day).padStart(2, "0") : "";
        e.startDate = `${year}${month ? "-" + month : ""}${day ? "-" + day : ""}`;
      }

      if (type === "ova") {
        e.episodes = "";
      }

      return e;
    });
    console.log("type:", type, "DATA:", response.data);

    return response.data;
  } catch (error) {
    console.error("error:", error);
  }
};

export const fetchDetailAnime = async (type, id) => {
  try {
    const response = await axios.get(`${API_URL}/service/anime/detail/${id}`, { params: { type } });
    let animeData = response.data;

    // response가 배열인지 단일 객체인지 체크
    if (Array.isArray(animeData)) {
      animeData = animeData[0];
    }

    // startDate 포맷
    if (animeData.startDate) {
      const { year = "", month, day } = animeData.startDate;
      animeData.startDate = `${year}${month ? "-" + String(month).padStart(2, "0") : ""}${day ? "-" + String(day).padStart(2, "0") : ""}`;
    }

    return animeData;
  } catch (error) {
    console.error(error);
  }
};

// export const fetchDetailAnime = async (type, id) => {
//   const body = { type };

//   try {
//     let response = await axios.get(`${API_URL}/service/anime/detail/${id}`, {
//       params: body,
//     });

//     const anime = response.data;

//     // startDate 포맷
//     if (anime.startDate) {
//       const year = anime.startDate.year ?? "";
//       const month = anime.startDate.month ? String(anime.startDate.month).padStart(2, "0") : "";
//       const day = anime.startDate.day ? String(anime.startDate.day).padStart(2, "0") : "";
//       anime.startDate = `${year}${month ? "-" + month : ""}${day ? "-" + day : ""}`;
//     }
//     console.log("1", anime);

//     return anime;
//   } catch (error) {
//     console.error("error:", error);
//   }
// };
