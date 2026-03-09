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

    // response.data.map((e) => {
    //   if (e.startDate) {
    //     const year = e.startDate.year ?? "";
    //     const month = e.startDate.month ? String(e.startDate.month).padStart(2, "0") : "";
    //     const day = e.startDate.day ? String(e.startDate.day).padStart(2, "0") : "";
    //     e.startDate = `${year}${month ? "-" + month : ""}${day ? "-" + day : ""}`;
    //   }

    //   if (type === "ova") {
    //     e.episodes = "";
    //   }

    //   return e;
    // });
  } catch (error) {
    console.error("error:", err);
  }

  console.log("type:", type, "DATA:", response.data);

  return response.data;
};

export const fetchDetailAnime = async (type, id) => {
  const body = {
    type,
  };
  try {
    let response = await axios.get(`${API_URL}/service/anime/detail/${id}`, {
      params: body,
    });

    response.data.map((e) => {
      if (e.startDate) {
        const year = e.startDate.year ?? "";
        const month = e.startDate.month ? String(e.startDate.month).padStart(2, "0") : "";
        const day = e.startDate.day ? String(e.startDate.day).padStart(2, "0") : "";
        e.startDate = `${year}${month ? "-" + month : ""}${day ? "-" + day : ""}`;
      }

      return e;
    });
  } catch (error) {
    console.log("error:", error);
  }

  return response.data[0];
};
