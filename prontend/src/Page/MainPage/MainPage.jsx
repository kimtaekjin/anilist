import { useEffect, useState } from "react";
import { fetchHomeAnime, getCachedHomeAnime } from "../../Components/items/AniListItem";
import MainPageCard from "./MainPageCard";

const MAIN_PAGE_LIMIT = 30;
const cachedHomeAnime = getCachedHomeAnime(MAIN_PAGE_LIMIT);

const MainPage = () => {
  const [trendingAnime, setTrendingAnime] = useState(cachedHomeAnime?.trending || []);
  const [completedAnime, setCompletedAnime] = useState(cachedHomeAnime?.completed || []);
  const [ovaAnime, setOvaAnime] = useState(cachedHomeAnime?.ova || []);

  useEffect(() => {
    const fetchAnime = async () => {
      try {
        const homeAnime = await fetchHomeAnime(MAIN_PAGE_LIMIT);

        setTrendingAnime(homeAnime?.trending || []);
        setCompletedAnime(homeAnime?.completed || []);
        setOvaAnime(homeAnime?.ova || []);
      } catch (err) {
        console.error(err);
      }
    };

    fetchAnime();
  }, []);

  return (
    <div>
      <MainPageCard title="추천 애니" animeList={trendingAnime} />
      <MainPageCard title="완결 애니" animeList={completedAnime} />
      <MainPageCard title="OVA / 극장판" animeList={ovaAnime} />
    </div>
  );
};

export default MainPage;
