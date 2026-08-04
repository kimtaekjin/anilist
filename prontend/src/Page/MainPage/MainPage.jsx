import { useEffect, useState } from "react";
import { fetchHomeAnime, getCachedHomeAnime } from "../../Components/items/AniListItem";
import MainPageCard from "./MainPageCard";

const MAIN_PAGE_LIMIT = 30;
const EMPTY_HOME_ANIME = { trending: [], completed: [], ova: [] };

const MainPage = () => {
  const [homeAnime, setHomeAnime] = useState(
    () => getCachedHomeAnime(MAIN_PAGE_LIMIT) || EMPTY_HOME_ANIME,
  );

  useEffect(() => {
    const cached = getCachedHomeAnime(MAIN_PAGE_LIMIT);
    if (cached) return;

    let cancelled = false;

    const fetchAnime = async () => {
      try {
        const fetchedHomeAnime = await fetchHomeAnime(MAIN_PAGE_LIMIT);
        if (!cancelled) setHomeAnime(fetchedHomeAnime || EMPTY_HOME_ANIME);
      } catch (err) {
        console.error(err);
      }
    };

    fetchAnime();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div>
      <MainPageCard title="추천 애니" animeList={homeAnime.trending} eagerImageCount={4} />
      <MainPageCard title="완결 애니" animeList={homeAnime.completed} />
      <MainPageCard title="OVA / 극장판" animeList={homeAnime.ova} />
    </div>
  );
};

export default MainPage;
