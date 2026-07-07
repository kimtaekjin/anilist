import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CalendarDays, Tv } from "lucide-react";
import { fetchAniList } from "../../Components/items/AniListItem.jsx";
import { AiringSkeleton } from "../../Components/items/Skeleton";

const days = ["전체", "일", "월", "화", "수", "목", "금", "토"];

function normalizeDay(day) {
  return days.includes(day) ? day : "";
}

const Airing = () => {
  const [animeList, setAnimeList] = useState([]);
  const [selectedDay, setSelectedDay] = useState("전체");
  const [isLoading, setIsLoading] = useState(true);

  const navigate = useNavigate();

  useEffect(() => {
    const fetchAiring = async () => {
      try {
        const processed = await fetchAniList("airing");
        setAnimeList(processed || []);
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
    return animeList.filter((anime) => normalizeDay(anime.days) === selectedDay);
  }, [animeList, selectedDay]);

  return (
    <section className="mx-auto min-h-screen max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-7 flex flex-col gap-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-amber-400">
          <Tv size={16} />
          <span>주간 방영표</span>
        </div>
        <h1 className="text-3xl font-bold tracking-normal text-stone-50 sm:text-4xl">방영중 애니</h1>
      </div>

      <div className="mb-8 flex gap-2 overflow-x-auto rounded-lg border border-stone-100/10 bg-[#181816]/90 p-2 shadow-xl shadow-black/25 backdrop-blur">
        {days.map((day) => (
          <button
            key={day}
            type="button"
            onClick={() => setSelectedDay(day)}
            className={`h-10 shrink-0 rounded-md px-4 text-sm font-bold transition duration-200 focus:outline-none focus:ring-4 focus:ring-amber-500/20 ${
              selectedDay === day
                ? "bg-red-600 text-white shadow-lg shadow-red-950/30"
                : "text-stone-300 hover:-translate-y-0.5 hover:bg-stone-100/8 hover:text-amber-300"
            }`}
          >
            {day}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 md:grid-cols-4">
        {isLoading
          ? Array.from({ length: 8 }).map((_, i) => <AiringSkeleton key={i} />)
          : filteredList.map((anime) => {
              const day = normalizeDay(anime.days);

              return (
                <button
                  key={anime._id}
                  type="button"
                  onClick={() => navigate(`/AnimeDetail/${anime._id}`)}
                  className="group overflow-hidden rounded-lg border border-stone-100/10 bg-[#181816] text-left shadow-xl shadow-black/25 transition duration-300 hover:-translate-y-1 hover:border-amber-500/60 hover:shadow-amber-950/30 focus:outline-none focus:ring-4 focus:ring-amber-500/20"
                >
                  <div className="overflow-hidden">
                    <img
                      src={anime.image?.large}
                      alt={anime.title}
                      className="h-48 w-full object-cover transition duration-500 group-hover:scale-105"
                    />
                  </div>
                  <div className="p-4">
                    <h3 className="h-12 text-base font-bold leading-snug text-stone-50 line-clamp-2">{anime.title}</h3>
                    <div className="mt-3 flex items-center justify-between gap-2 text-sm">
                      <span className="inline-flex min-w-0 items-center gap-1 rounded-full border border-cyan-300/15 bg-cyan-300/8 px-2.5 py-1 font-semibold text-cyan-100">
                        <CalendarDays size={14} className="shrink-0 text-cyan-200/80" />
                        <span className="truncate">{day ? `${day}요일` : "방영일 미정"}</span>
                      </span>
                      <span className="shrink-0 rounded-full border border-violet-300/15 bg-violet-300/8 px-2.5 py-1 font-semibold text-violet-100">
                        {anime.episodes ? `${anime.episodes}화` : "회차 미정"}
                      </span>
                    </div>
                  </div>
                </button>
              );
            })}
      </div>
    </section>
  );
};

export default Airing;
