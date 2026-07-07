import { useEffect, useState } from "react";
import { fetchAniList } from "../../Components/items/AniListItem";
import MainPageCard from "./MainPageCard";

const getAnimeId = (anime) => anime?._id ?? anime?.id;

const MainPage = () => {
  const [trendingAnime, setTrendingAnime] = useState([]);
  const [completedAnime, setCompletedAnime] = useState([]);
  const [ovaAnime, setOvaAnime] = useState([]);

  useEffect(() => {
    const fetchAnime = async () => {
      try {
        const [trending, ovaAni] = await Promise.all([fetchAniList("trending"), fetchAniList("ova")]);
        const trendingList = trending || [];
        const trendingIds = trendingList.map(getAnimeId).filter(Boolean).join(",");

        const completed = await fetchAniList("completed", undefined, undefined, {
          exclude: trendingIds,
        });

        setTrendingAnime(trendingList);
        setCompletedAnime(completed || []);
        setOvaAnime(ovaAni || []);
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
