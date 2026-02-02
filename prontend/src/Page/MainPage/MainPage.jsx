import { useEffect, useState } from "react";
import { fetchTrendingAnime, fetchCompletedAnime, fetchOVAAnime } from "../../Components/items/AniListItem";
import MainPageCard from "./MainPageCard";

const CACHE_DURATION = 24 * 60 * 60 * 1000;

const MainPage = () => {
  const [trendingAnime, setTrendingAnime] = useState([]);
  const [completedAnime, setCompletedAnime] = useState([]);
  const [ovaAnime, setOvaAnime] = useState([]);

  useEffect(() => {
    const fetchAnime = async () => {
      try {
        const now = Date.now();

        const cachedTrending = JSON.parse(localStorage.getItem("trendingAnime")) || { data: [], updated: 0 };
        const cachedCompleted = JSON.parse(localStorage.getItem("completedAnime")) || { data: [], updated: 0 };
        const cachedOVA = JSON.parse(localStorage.getItem("ovaAnime")) || { data: [], updated: 0 };

        if (
          cachedTrending.data.length &&
          cachedCompleted.data.length &&
          cachedOVA.data.length &&
          now - cachedTrending.updated < CACHE_DURATION
        ) {
          setTrendingAnime(cachedTrending.data);
          setCompletedAnime(cachedCompleted.data);
          setOvaAnime(cachedOVA.data);

          return;
        }

        const [trendingAni, completedAni, ovaAni] = await Promise.all([
          fetchTrendingAnime(),
          fetchCompletedAnime(),
          fetchOVAAnime(),
        ]);

        const uniqueCompleted = completedAni.filter((anime) => !trendingAni.some((t) => t.id === anime.id));

        setTrendingAnime(trendingAni);
        setCompletedAnime(uniqueCompleted);
        setOvaAnime(ovaAni);

        localStorage.setItem("trendingAnime", JSON.stringify({ data: trendingAni, updated: now }));
        localStorage.setItem("completedAnime", JSON.stringify({ data: uniqueCompleted, updated: now }));
        localStorage.setItem("ovaAnime", JSON.stringify({ data: ovaAni, updated: now }));
      } catch (err) {
        console.error(err);
      }
    };

    fetchAnime();
  }, []);

  return (
    <div>
      <MainPageCard title="추천 애니" animeList={trendingAnime} />
      <MainPageCard title="종영" animeList={completedAnime} />
      <MainPageCard title="OVA / 극장판" animeList={ovaAnime} />
    </div>
  );
};

export default MainPage;
