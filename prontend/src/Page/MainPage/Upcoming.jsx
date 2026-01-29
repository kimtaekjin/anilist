import React, { useEffect, useState } from "react";
import { Calendar, Building } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { fetchUpcommingAnime } from "../../Components/items/aniListQuery";

// const genreMapKR = {
//   Action: "액션",
//   Romance: "로맨스",
//   Fantasy: "판타지",
//   "Slice of Life": "일상",
//   Sports: "스포츠",
//   SciFi: "SF",
//   Adventure: "모험",
//   Comedy: "코미디",
//   Horror: "공포",
//   Mystery: "미스터리",
// };

// Skeleton 카드
const AnimeCardSkeleton = () => (
  <div className="rounded-3xl bg-white shadow-xl overflow-hidden animate-pulse">
    <div className="aspect-[16/9] bg-gray-200" />
    <div className="p-6 space-y-2">
      <div className="h-5 bg-gray-200 rounded w-3/4" />
      <div className="h-4 bg-gray-200 rounded w-full" />
      <div className="h-4 bg-gray-200 rounded w-5/6" />
      <div className="h-3 bg-gray-200 rounded w-1/3 mt-2" />
    </div>
  </div>
);

const CACHE_DURATION = 24 * 60 * 60 * 1000;

const Upcoming = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [animeList, setAnimeList] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchUpcomingAnime = async () => {
      setIsLoading(true);

      try {
        const now = Date.now();
        const cachedUpcomming = JSON.parse(localStorage.getItem("upcommingAnime")) || { data: [], updated: 0 };

        if (cachedUpcomming.data.length && now - cachedUpcomming.updated < CACHE_DURATION) {
          setAnimeList(cachedUpcomming.data);
          return;
        }
        const data = await fetchUpcommingAnime();
        setAnimeList(data);
        localStorage.setItem("upcommingAnime", JSON.stringify({ data: data, updated: now }));
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
          {animeList.map((anime) => (
            <div
              key={anime.id}
              onClick={() => navigate(`/AnimeDetail/${anime.id}`)}
              className="bg-white rounded-2xl overflow-hidden shadow-lg hover:shadow-2xl transition cursor-pointer"
            >
              {/* 이미지 */}
              {anime.image && (
                <div className="aspect-[4/3] w-full overflow-hidden">
                  <img src={anime.image} alt={anime.title} className="w-full h-full object-cover" />
                </div>
              )}

              {/* 정보 */}
              <div className="p-6">
                <div className="h-14 mb-1">
                  <h3 className="text-xl font-bold mb-2 text-gray-800 line-clamp-2">{anime.title}</h3>
                </div>

                {/* 장르 */}
                <div className="flex flex-wrap gap-2 h-7 ">
                  {anime.genre.slice(0, 3).map((g) => (
                    <span key={g} className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-xs font-semibold">
                      {g}
                    </span>
                  ))}
                  {anime.genre.length > 3 && (
                    <span className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-xs font-semibold">
                      +{anime.genre.length - 3}
                    </span>
                  )}
                </div>

                <div className="flex justify-between items-center text-gray-500 text-sm mt-1 border-t border-gray-200 pt-2">
                  <div className="flex items-center gap-1">
                    <Calendar size={14} className="text-gray-400" />
                    <span>{anime.startDate ? anime.startDate : "미정"}</span>
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
