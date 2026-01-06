import React, { useEffect, useState } from "react";
import { Calendar, Building } from "lucide-react";
// Skeleton 카드
const AnimeCardSkeleton = () => (
  <div className="rounded-3xl bg-white shadow-xl overflow-hidden animate-pulse">
    <div className="h-60 bg-gray-200" />
    <div className="p-6 space-y-2">
      <div className="h-5 bg-gray-200 rounded w-3/4" />
      <div className="h-4 bg-gray-200 rounded w-full" />
      <div className="h-4 bg-gray-200 rounded w-5/6" />
      <div className="h-3 bg-gray-200 rounded w-1/3 mt-2" />
    </div>
  </div>
);

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

        console.log(json);

        const translatedData = await Promise.all(
          json.data.map(async (anime) => {
            const titleKR = anime.title_japanese ? await translateText(anime.title_japanese) : anime.title;
            const synopsisKR = anime.synopsis ? await translateText(anime.synopsis) : "줄거리 정보 없음";
            const genreKR = anime.genres
              ? await Promise.all(anime.genres.map(async (g) => await translateText(g.name)))
              : [];

            return {
              id: anime.mal_id,
              title: titleKR,
              synopsis: synopsisKR,
              image: anime.images?.jpg?.image_url,
              genre: genreKR || [],
              startDate: anime.aired?.from ? anime.aired.from.slice(0, 10) : "미정",
              studio: anime.studios?.[0]?.name || "미정",
            };
          })
        );

        // 중복 제거 (mal_id 기준)
        const uniqueAnimeList = Array.from(new Map(translatedData.map((a) => [a.id, a])).values());

        setAnimeList(uniqueAnimeList);
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
      <h1 className="text-3xl font-extrabold mb-12 text-center">방영 예정 작품</h1>

      {/* 로딩 */}
      {isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {Array.from({ length: 6 }).map((_, i) => (
            <AnimeCardSkeleton key={i} />
          ))}
        </div>
      )}

      {/* 작품 리스트 */}
      {!isLoading && animeList.length === 0 && <p className="text-gray-400 text-center">방영 예정 작품이 없습니다.</p>}

      {!isLoading && animeList.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {animeList.map((anime, idx) => (
            <div
              key={anime.mal_id}
              className="bg-white rounded-2xl overflow-hidden shadow-lg hover:shadow-2xl transition"
            >
              {/* 이미지 */}
              {anime.image && (
                <img
                  src={anime.image}
                  alt={anime.title}
                  className="w-full h-60 object-cover border-b border-gray-200"
                />
              )}

              {/* 정보 */}
              <div className="p-6">
                <h3 className="text-xl font-bold mb-2 text-gray-800">{anime.title}</h3>

                {/* 장르 */}
                <div className="flex flex-wrap gap-2 mb-3">
                  {anime.genre.map((g) => (
                    <span
                      key={g} // 안전한 key
                      className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-xs font-semibold"
                    >
                      {g}
                    </span>
                  ))}
                </div>

                <div className="flex justify-between items-center text-gray-500 text-sm mt-4 border-t border-gray-200 pt-2">
                  <div className="flex items-center gap-1">
                    <Calendar size={14} className="text-gray-400" />
                    <span>{anime.startDate}</span>
                  </div>

                  <div className="flex items-center gap-1">
                    <Building size={14} className="text-gray-400" />
                    <span>{anime.studio}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Upcoming;
