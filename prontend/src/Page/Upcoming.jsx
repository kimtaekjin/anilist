// pages/UpcomingAnimePage.jsx
import React, { useEffect, useState } from "react";

const Upcoming = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [animeList, setAnimeList] = useState([]);

  // 번역 함수
  const translateText = async (text) => {
    try {
      const res = await fetch("http://localhost:3000/service/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, target: "ko" }),
      });
      const data = await res.json();
      return data.translatedText || text;
    } catch (err) {
      console.error("Translation error:", err);
      return text;
    }
  };

  useEffect(() => {
    const fetchUpcomingAnime = async () => {
      try {
        const res = await fetch("https://api.jikan.moe/v4/seasons/upcoming");
        const json = await res.json();

        // 병렬 번역 처리
        const translatedData = await Promise.all(
          json.data.map(async (anime) => {
            const titleKR = anime.title_japanese ? await translateText(anime.title_japanese) : anime.title;

            const synopsisKR = anime.synopsis ? await translateText(anime.synopsis) : "줄거리 정보 없음";

            return {
              id: anime.mal_id,
              title: titleKR,
              synopsis: synopsisKR,
              image: anime.images?.jpg?.image_url,
              genre: anime.genres?.map((g) => g.name) || [],
              startDate: anime.aired?.from ? anime.aired.from.slice(0, 10) : "미정",
              studio: anime.studios?.[0]?.name || "미정",
            };
          })
        );

        setAnimeList(translatedData);
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchUpcomingAnime();
  }, []);

  return (
    <div className="container mx-auto px-4 py-20">
      <h1 className="text-3xl font-extrabold mb-12">방영 예정 작품</h1>

      {/* 로딩 */}
      {isLoading && <p className="text-center text-gray-400">로딩 중...</p>}

      {/* 작품 리스트 */}
      {!isLoading && animeList.length === 0 && <p className="text-gray-400 text-center">방영 예정 작품이 없습니다.</p>}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {animeList.map((anime) => (
          <div
            key={anime.id}
            className="bg-gradient-to-b from-gray-100 to-white rounded-3xl shadow-xl overflow-hidden transform hover:scale-105 transition-all duration-300"
          >
            {/* 이미지 */}
            {anime.image && (
              <img src={anime.image} alt={anime.title} className="w-full h-60 object-cover border-b border-gray-200" />
            )}

            {/* 정보 */}
            <div className="p-6">
              <h3 className="text-xl font-bold mb-2 text-gray-800">{anime.title}</h3>

              {/* 장르 */}
              <div className="flex flex-wrap gap-2 mb-3">
                {anime.genre.map((g, index) => (
                  <span key={index} className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-xs font-semibold">
                    {g}
                  </span>
                ))}
              </div>

              <p className="text-gray-500 text-sm mb-2 line-clamp-3">{anime.synopsis}</p>

              <div className="flex justify-between text-gray-400 text-sm mt-4 border-t border-gray-200 pt-2">
                <span>방영 시작: {anime.startDate}</span>
                <span>제작: {anime.studio}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Upcoming;
