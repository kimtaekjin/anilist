import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { fetchAiringAnime } from "../../Components/items/aniListQuery";

const AnimeCardSkeleton = () => (
  <div className="rounded-2xl bg-white shadow-lg overflow-hidden animate-pulse">
    <div className="h-48 bg-gray-200" />
    <div className="p-4 space-y-2">
      <div className="h-5 bg-gray-200 rounded w-3/4" />
      <div className="h-4 bg-gray-200 rounded w-full" />
    </div>
  </div>
);

const days = ["전체", "월", "화", "수", "목", "금", "토", "일"];

const Airing = () => {
  const [animeList, setAnimeList] = useState([]);
  const [selectedDay, setSelectedDay] = useState("전체");
  const [isLoading, setIsLoading] = useState(true);

  const navigate = useNavigate();

  useEffect(() => {
    const fetchAiring = async () => {
      try {
        const processed = await fetchAiringAnime();
        setAnimeList(processed);
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAiring();
  }, []);

  const filteredList = useMemo(() => {
    if (selectedDay === "전체") return animeList;
    return animeList.filter((anime) => anime.day === selectedDay);
  }, [animeList, selectedDay]);

  return (
    <div className="container mx-auto px-4 py-20">
      <h1 className="text-3xl font-bold mb-8">방영중 애니</h1>

      <div className="flex space-x-4 mb-8 overflow-x-auto scrollbar-hide">
        {days.map((day) => (
          <button
            key={day}
            onClick={() => setSelectedDay(day)}
            className={`px-4 py-2 rounded-full font-medium transition ${
              selectedDay === day ? "bg-red-600 text-white" : "bg-gray-200 text-gray-700 hover:bg-gray-300"
            }`}
          >
            {day}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-6">
        {isLoading
          ? Array.from({ length: 8 }).map((_, i) => <AnimeCardSkeleton key={i} />)
          : filteredList.map((anime) => (
              <div
                key={anime.id}
                onClick={() => navigate(`/AnimeDetail/${anime.id}`)}
                className="bg-white cursor-pointer rounded-2xl shadow-lg overflow-hidden"
              >
                <img src={anime.image} alt={anime.title} className="w-full h-48 object-cover" />
                <div className="p-4">
                  <h3 className="font-bold text-base line-clamp-2 h-12">{anime.title}</h3>
                  <div className="flex justify-between text-sm text-gray-400 mt-1">
                    <span>{anime.year}년</span>
                    <span>{anime.quarter}</span>
                  </div>
                </div>
              </div>
            ))}
      </div>
    </div>
  );
};

export default Airing;
