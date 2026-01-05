import React, { useEffect, useState, useMemo } from "react";
import { useSearchParams } from "react-router-dom";

// 장르 리스트
const genresList = ["액션", "로맨스", "판타지", "SF", "일상", "스포츠"];

// Skeleton 카드
const AnimeCardSkeleton = () => (
  <div className="rounded-3xl bg-white shadow-xl overflow-hidden animate-pulse">
    <div className="h-64 bg-gray-200" />
    <div className="p-6 space-y-3">
      <div className="h-5 bg-gray-200 rounded w-3/4" />
      <div className="h-4 bg-gray-200 rounded w-full" />
      <div className="h-4 bg-gray-200 rounded w-5/6" />
    </div>
  </div>
);

const UpcomingAnimePage = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [animeList, setAnimeList] = useState([]);
  const [searchParams, setSearchParams] = useSearchParams();

  // URL에서 장르 가져오기
  const initialGenres = useMemo(() => {
    const param = searchParams.get("genre");
    return param ? param.split(",") : [];
  }, [searchParams]);

  const [selectedGenres, setSelectedGenres] = useState(initialGenres);

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

  // 데이터 가져오기
  useEffect(() => {
    const fetchUpcomingAnime = async () => {
      try {
        const res = await fetch("https://api.jikan.moe/v4/seasons/upcoming");
        const json = await res.json();

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

  // 장르 선택 토글
  const toggleGenre = (genre) => {
    const next = selectedGenres.includes(genre)
      ? selectedGenres.filter((g) => g !== genre)
      : [...selectedGenres, genre];
    setSelectedGenres(next);

    if (next.length === 0) {
      searchParams.delete("genre");
      setSearchParams(searchParams);
    } else {
      setSearchParams({ genre: next.join(",") });
    }
  };

  // 필터 적용
  const filteredList =
    selectedGenres.length === 0
      ? animeList
      : animeList.filter((anime) => anime.genre.some((g) => selectedGenres.includes(g)));

  return (
    <div className="container mx-auto px-4 py-20">
      {/* 타이틀 */}
      <h1 className="text-4xl font-extrabold mb-8 text-center bg-gradient-to-r from-pink-500 via-red-500 to-yellow-500 text-transparent bg-clip-text">
        방영 예정 작품
      </h1>

      {/* 장르 필터 */}
      <div className="flex flex-wrap justify-center gap-3 mb-12">
        {genresList.map((genre) => {
          const active = selectedGenres.includes(genre);
          return (
            <button
              key={genre}
              onClick={() => toggleGenre(genre)}
              className={`px-5 py-2 rounded-full font-semibold text-sm transition-all duration-200 ${
                active
                  ? "bg-red-500 text-white scale-105 shadow-lg"
                  : "bg-gray-100 text-gray-700 hover:bg-red-100 hover:text-red-600"
              }`}
            >
              {genre}
            </button>
          );
        })}
      </div>

      {/* 로딩 */}
      {isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {Array.from({ length: 6 }).map((_, i) => (
            <AnimeCardSkeleton key={i} />
          ))}
        </div>
      )}

      {/* 결과 */}
      {!isLoading && filteredList.length === 0 && (
        <p className="text-gray-400 text-center text-lg">선택된 장르의 작품이 없습니다.</p>
      )}

      {!isLoading && filteredList.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {filteredList.map((anime) => (
            <div
              key={anime.id}
              className="bg-gradient-to-b from-white via-gray-50 to-gray-100 rounded-3xl shadow-2xl overflow-hidden transform hover:scale-105 hover:shadow-3xl transition-all duration-300"
            >
              {anime.image && (
                <img
                  src={anime.image}
                  alt={anime.title}
                  className="w-full h-64 object-cover border-b border-gray-200"
                />
              )}
              <div className="p-6">
                <h3 className="text-xl font-bold mb-2 text-gray-800 hover:text-red-500 transition-colors duration-200">
                  {anime.title}
                </h3>

                {/* 장르 */}
                <div className="flex flex-wrap gap-2 mb-3">
                  {anime.genre.map((g, idx) => (
                    <span key={idx} className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-xs font-semibold">
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
      )}
    </div>
  );
};

export default UpcomingAnimePage;
