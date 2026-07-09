import React, { useEffect, useMemo, useState } from "react";
import { Building, CalendarDays, Clapperboard, Search } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { fetchAniList, getCachedAniList } from "../../Components/items/AniListItem.jsx";
import { UpcommingSkeleton } from "../../Components/items/Skeleton";
import Pagination from "../../Components/Pagination/Pagination.jsx";

const cachedUpcoming = getCachedAniList("upcoming") || [];

const Upcoming = () => {
  const [isLoading, setIsLoading] = useState(cachedUpcoming.length === 0);
  const [animeList, setAnimeList] = useState(cachedUpcoming);
  const [searchName, setSearchName] = useState("");
  const navigate = useNavigate();

  const itemsPerPage = 18;
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    const fetchUpcomingAnime = async () => {
      setCurrentPage(1);

      try {
        const data = await fetchAniList("upcoming");
        setAnimeList(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error(err);
        setAnimeList([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchUpcomingAnime();
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchName]);

  const filteredList = useMemo(() => {
    const keyword = searchName.trim().toLowerCase();
    if (!keyword) return animeList;

    return animeList.filter((anime) => anime.title?.toLowerCase().includes(keyword));
  }, [animeList, searchName]);

  const startIndex = (currentPage - 1) * itemsPerPage;
  const currentItems = filteredList.slice(startIndex, startIndex + itemsPerPage);

  return (
    <section className="mx-auto min-h-screen max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-6 flex flex-col gap-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-amber-400">
          <Clapperboard size={16} />
          <span>Coming Soon</span>
        </div>
        <h1 className="text-3xl font-bold tracking-normal text-stone-50 sm:text-4xl">방영 예정작</h1>
      </div>

      <div className="mb-8 max-w-xl rounded-lg border border-stone-100/10 bg-[#181816]/90 p-2 shadow-xl shadow-black/25 backdrop-blur">
        <label className="flex h-11 items-center gap-2 rounded-md border border-stone-100/10 bg-[#10100f] px-3 transition duration-200 focus-within:border-amber-500 focus-within:ring-4 focus-within:ring-amber-500/15 hover:border-amber-500/60">
          <Search size={17} className="shrink-0 text-stone-500" />
          <input
            value={searchName}
            onChange={(e) => setSearchName(e.target.value)}
            className="h-full min-w-0 flex-1 bg-transparent text-sm font-semibold text-stone-100 outline-none placeholder:text-stone-500"
            placeholder="예정작 검색"
          />
        </label>
      </div>

      {isLoading && (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <UpcommingSkeleton key={i} />
          ))}
        </div>
      )}

      {!isLoading && filteredList.length === 0 && (
        <div className="rounded-lg border border-stone-100/10 bg-[#181816]/80 py-16 text-center text-stone-400">
          조건에 맞는 방영 예정 작품이 없습니다.
        </div>
      )}

      {!isLoading && filteredList.length > 0 && (
        <>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {currentItems.map((anime, index) => {
              const genres = Array.isArray(anime.genres) ? anime.genres : [];
              const studio = Array.isArray(anime.studio) ? anime.studio[0] : anime.studio;

              return (
                <button
                  key={anime._id}
                  type="button"
                  onClick={() => navigate(`/AnimeDetail/${anime._id}`)}
                  className="group overflow-hidden rounded-lg border border-stone-100/10 bg-[#181816] text-left shadow-xl shadow-black/25 transition duration-300 hover:-translate-y-1 hover:border-amber-500/60 hover:shadow-amber-950/30 focus:outline-none focus:ring-4 focus:ring-amber-500/20"
                >
                  {anime.image && (
                    <div className="aspect-[4/3] w-full overflow-hidden">
                      <img
                        src={anime.image.large}
                        alt={anime.title}
                        className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                        loading={index < 6 ? "eager" : "lazy"}
                        decoding="async"
                      />
                    </div>
                  )}

                  <div className="p-5">
                    <div className="mb-2 h-14">
                      <h3 className="line-clamp-2 text-xl font-bold leading-snug text-stone-50">{anime.title}</h3>
                    </div>

                    <div className="mb-4 flex h-8 flex-wrap gap-2 overflow-hidden">
                      {genres.slice(0, 3).map((genre) => (
                        <span
                          key={genre}
                          className="rounded-full bg-red-500/15 px-3 py-1 text-xs font-semibold text-red-200"
                        >
                          {genre}
                        </span>
                      ))}
                      {genres.length > 3 && (
                        <span className="rounded-full bg-amber-500/15 px-3 py-1 text-xs font-semibold text-amber-200">
                          +{genres.length - 3}
                        </span>
                      )}
                    </div>

                    <div className="flex justify-between gap-3 border-t border-stone-100/10 pt-3 text-sm text-stone-400">
                      <div className="flex min-w-0 items-center gap-1">
                        <CalendarDays size={14} className="shrink-0 text-cyan-200/80" />
                        <span className="truncate">{anime.startDate || "미정"}</span>
                      </div>

                      <div className="flex min-w-0 items-center gap-1">
                        <Building size={14} className="shrink-0 text-violet-200/80" />
                        <span className="truncate">{studio || "미정"}</span>
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          <Pagination
            currentPage={currentPage}
            totalItems={filteredList.length}
            itemsPerPage={itemsPerPage}
            onPageChange={setCurrentPage}
          />
        </>
      )}
    </section>
  );
};

export default Upcoming;
