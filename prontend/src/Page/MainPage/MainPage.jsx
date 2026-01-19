import { useEffect, useState } from "react";
import { translateText } from "../../Components/items/translate";
import MainPageCard from "./MainPageCard";

const MainPage = () => {
  const [trendingAnime, setTrendingAnime] = useState([]);
  const [completedAnime, setCompletedAnime] = useState([]);
  const [ovaAnime, setOvaAnime] = useState([]);

  useEffect(() => {
    const fetchAnime = async () => {
      const pages = [1, 2]; // 순차 요청
      const trending = [];
      const completed = [];
      const ova = [];

      for (let page of pages) {
        const res = await fetch(`https://api.jikan.moe/v4/top/anime?page=${page}`);
        const data = await res.json();
        const animeList = data.data || [];

        for (let anime of animeList) {
          // 번역 + 이미지 처리
          anime.title = anime.title_japanese ? await translateText(anime.title_japanese) : anime.title;
          anime.image = anime.images?.jpg?.image_url;

          // 추천 애니: score >= 7, scored_by 50k~80k, TV
          if (anime.score >= 7 && anime.scored_by >= 20000 && anime.type === "TV") {
            trending.push(anime);
          }

          // 인기 애니: scored_by >= 80k, TV
          if (anime.status === "Finished Airing" && anime.type === "TV") {
            completed.push(anime);
          }

          // OVA / Movie
          if (["OVA", "Movie"].includes(anime.type)) {
            ova.push(anime);
          }
        }

        // 500ms 딜레이로 rate limit 방지
        await new Promise((resolve) => setTimeout(resolve, 500));
      }

      // 정렬 + 상위 N개 선택
      setTrendingAnime(trending.sort((a, b) => b.scored_by - a.scored_by).slice(0, 30));
      console.log(trending);

      setCompletedAnime(completed.slice(0, 30));
      setOvaAnime(ova); // 전체 OVA/Movie
    };

    fetchAnime();
  }, []);

  return (
    <div>
      {/* <MainPageCard title="추천 애니" animeList={trendingAnime} />
      <MainPageCard title="종영" animeList={completedAnime} />
      <MainPageCard title="OVA / 극장판" animeList={ovaAnime} /> */}
    </div>
  );
};

export default MainPage;
