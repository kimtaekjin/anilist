import { useEffect, useState } from "react";
import { translateText } from "../../Components/items/translate";
import MainPageCard from "./MainPageCard";

const MainPage = () => {
  const [trendingAinme, SetTrendingAnime] = useState([]);
  const [popularAnime, setPopilarAnime] = useState([]);
  const [ovaAnime, SetOvaAnime] = useState([]);

  useEffect(() => {
    const fetchAnime = async () => {
      const res = await fetch("https://api.jikan.moe/v4/top/anime");
      const data = await res.json();

      const translatedAnime = await Promise.all(
        data.data.map(async (anime) => ({
          ...anime,
          title: anime.title_japanese ? await translateText(anime.title_japanese) : [],
          image: anime.images?.jpg?.image_url,
        }))
      );
      SetTrendingAnime(translatedAnime.filter((a) => a.score >= 8.0 && a.scored_by > 50000));
      setPopilarAnime(translatedAnime.filter((a) => a.scored_by > 100000));
      SetOvaAnime(translatedAnime.filter((a) => a.type === "OVA"));
    };

    fetchAnime();
  }, []);

  console.log(trendingAinme);

  return (
    <div>
      <MainPageCard title="추천 애니" animeList={trendingAinme} />
      {/* <Trending />  
      <Trending /> */}
    </div>
  );
};

export default MainPage;
