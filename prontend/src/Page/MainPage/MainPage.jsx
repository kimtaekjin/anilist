import { useEffect, useState } from "react";
import { fetchTrendingAnime, fetchCompletedAnime, fetchOVAAnime } from "../../Components/items/AniListItem";
import MainPageCard from "./MainPageCard";

const MainPage = () => {
  const [trendingAnime, setTrendingAnime] = useState([]);
  const [completedAnime, setCompletedAnime] = useState([]);
  const [ovaAnime, setOvaAnime] = useState([]);

  useEffect(() => {
    const fetchAnime = async () => {
      try {
        const [trendingAni, Completed, ovaAni] = await Promise.all([
          fetchTrendingAnime(),
          fetchCompletedAnime(),
          fetchOVAAnime(),
        ]);

        setTrendingAnime(trendingAni);
        setCompletedAnime(Completed);

        setOvaAnime(ovaAni);
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
