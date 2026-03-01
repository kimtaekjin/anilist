import axios from "axios";

const API_URL = process.env.REACT_APP_CLIENT_URL;

export const fetchTrendingAnime = async () => {
  const response = await axios.get(`${API_URL}/service/anime/trending`);

  return response.data;
};

export const fetchCompletedAnime = async () => {
  const response = await axios.get(`${API_URL}/service/anime/completed`);

  return response.data;
};

export const fetchOVAAnime = async () => {
  const response = await axios.get(`${API_URL}/service/anime/ova`);
  return response.data;
};

export const fetchAiringAnime = async () => {
  const response = await axios.get(`${API_URL}/service/anime/airing`);
  return response.data;
};

export const fetchGenreAnime = async (selectedSeason, selectedYear) => {
  const response = await axios.get(`${API_URL}/service/anime/genre`, {
    params: {
      season: selectedSeason,
      year: selectedYear,
    },
  });

  return response.data;
};

export const fetchUpcommingAnime = async () => {
  const response = await axios.get(`${API_URL}/service/anime/upcomming`);

  const data = response.data.map((e) => {
    if (e.startDate) {
      const year = e.startDate.year ?? "";
      const month = e.startDate.month ? String(e.startDate.month).padStart(2, "0") : "";
      const day = e.startDate.day ? String(e.startDate.day).padStart(2, "0") : "";
      e.startDate = `${year}${month ? "-" + month : ""}${day ? "-" + day : ""}`;
    }
    return e;
  });

  return data;
};

export const fetchDetailAnime = async (id) => {
  const response = await axios.get(`${API_URL}/service/anime/detail`, {
    params: {
      id,
    },
  });
  return response.data;
};
