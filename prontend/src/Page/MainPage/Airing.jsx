import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { fetchAiringAnime } from "../../components/items/AniListQuery.jsx";
import { AiringSkeleton } from "../../components/items/Skeleton";

const days = ["전체", "월", "화", "수", "목", "금", "토", "일"];

const CACHE_DURATION = 24 * 60 * 60 * 1000;

const Airing = () => {
  const [animeList, setAnimeList] = useState([]);
  const [selectedDay, setSelectedDay] = useState("전체");
  const [isLoading, setIsLoading] = useState(true);

  const navigate = useNavigate();

  useEffect(() => {
    const fetchAiring = async () => {
      try {
        const now = Date.now();

        const cachedAiring = JSON.parse(localStorage.getItem("animeList")) || { data: [], updated: 0 };

        if (cachedAiring.data.length && now - cachedAiring.updated < CACHE_DURATION) {
          setAnimeList(cachedAiring.data);
          return;
        }
        const processed = await fetchAiringAnime();
        setAnimeList(processed);

        localStorage.setItem("animeList", JSON.stringify({ data: processed, updated: now }));
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
          ? Array.from({ length: 8 }).map((_, i) => <AiringSkeleton key={i} />)
          : filteredList.map((anime) => (
              <div
                key={anime.id}
                onClick={() => navigate(`/AnimeDetail/${anime.id}`)}
                className="bg-white cursor-pointer rounded-2xl shadow-lg overflow-hidden
                hover:shadow-2xl transition"
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
