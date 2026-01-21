import { useEffect, useState } from "react";
import { fetchTrendingAnime, fetchCompletedAnime, fetchOVAAnime } from "../../Components/items/aniListQuery";
import MainPageCard from "./MainPageCard";

const MainPage = () => {
  const [trendingAnime, setTrendingAnime] = useState([]);
  const [completedAnime, setCompletedAnime] = useState([]);
  const [ovaAnime, setOvaAnime] = useState([]);

  const CACHE_DURATION = 60 * 60 * 1000; // 10분

  useEffect(() => {
    const fetchAnime = async () => {
      try {
        const now = Date.now();
        // 1️⃣ localStorage에서 저장된 데이터 읽기
        const cachedTrending = JSON.parse(localStorage.getItem("trendingAnime")) || { data: [], updated: 0 };
        const cachedCompleted = JSON.parse(localStorage.getItem("completedAnime")) || { data: [], updated: 0 };
        const cachedOVA = JSON.parse(localStorage.getItem("ovaAnime")) || { data: [], updated: 0 };

        // 2️⃣ 캐시가 있으면 바로 보여주기
        if (
          cachedTrending.data.length &&
          cachedCompleted.data.length &&
          cachedOVA.data.length &&
          now - cachedTrending.updated < CACHE_DURATION
        ) {
          setTrendingAnime(cachedTrending.data);
          setCompletedAnime(cachedCompleted.data);
          setOvaAnime(cachedOVA.data);
          console.log("확인");

          return;
        }

        const [trendingAni, completedAni, ovaAni] = await Promise.all([
          fetchTrendingAnime(),
          fetchCompletedAnime(),
          fetchOVAAnime(),
        ]);

        const uniqueCompleted = completedAni.filter((anime) => !trendingAni.some((t) => t.id === anime.id));

        // console.log(uniqueCompleted);

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
