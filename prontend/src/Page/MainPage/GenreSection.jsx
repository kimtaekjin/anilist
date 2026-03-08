import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Calendar, Building } from "lucide-react";
import Pagination from "../../Components/Pagination/Pagination";
import { fetchAniList } from "../../Components/items/AniListItem.jsx";
import { GenreSkeleton } from "../../Components/items/Skeleton";

const genresList = ["액션", "로맨스", "판타지", "SF", "일상", "스포츠", "모험"];

const seasonOptions = [
  { label: "겨울 (1분기)", value: "WINTER" },
  { label: "봄 (2분기)", value: "SPRING" },
  { label: "여름 (3분기)", value: "SUMMER" },
  { label: "가을 (4분기)", value: "FALL" },
];

const currentYear = new Date().getFullYear();
const yearOptions = Array.from({ length: currentYear - 2009 }, (_, i) => currentYear - i);

const getCurrentSeason = () => {
  const m = new Date().getMonth() + 1;
  if (m <= 3) return "WINTER";
  if (m <= 6) return "SPRING";
  if (m <= 9) return "SUMMER";
  return "FALL";
};

const GenreSection = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [selectedGenres, setSelectedGenres] = useState(searchParams.get("genres")?.split(",") || []);
  const [selectedSeason, setSelectedSeason] = useState(searchParams.get("season") || getCurrentSeason());
  const [selectedYear, setSelectedYear] = useState(Number(searchParams.get("year")) || currentYear);

  const [animeList, setAnimeList] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 12;

  useEffect(() => {
    const fetchAnime = async () => {
      setIsLoading(true);
      setCurrentPage(1);

      try {
        const processed = await fetchAniList("genre", selectedSeason, selectedYear);

        setAnimeList(processed);
      } catch (e) {
        console.error(e);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAnime();
  }, [selectedSeason, selectedYear]);

  /* ---------- URL Sync ---------- */
  useEffect(() => {
    const params = {};
    if (selectedGenres.length) params.genres = selectedGenres.join(",");
    params.season = selectedSeason;
    params.year = selectedYear;
    setSearchParams(params);
  }, [selectedGenres, selectedSeason, selectedYear, setSearchParams]);

  /* ---------- 필터 ---------- */
  const filteredList = useMemo(() => {
    if (!selectedGenres.length) return animeList;
    return animeList.filter((a) => a.genres.some((g) => selectedGenres.includes(g)));
  }, [animeList, selectedGenres]);

  const currentItems = filteredList.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const toggleGenre = (genre) => {
    setCurrentPage(1);
    setSelectedGenres((prev) => (prev.includes(genre) ? prev.filter((g) => g !== genre) : [...prev, genre]));
  };

  return (
    <div className="container mx-auto px-4 py-20">
      <h1 className="text-3xl font-bold mb-6">장르 · 분기별 작품</h1>

      <div className="flex gap-4 mb-6 flex-wrap">
        <select
          value={selectedSeason}
          onChange={(e) => setSelectedSeason(e.target.value)}
          className="px-4 py-2 rounded-lg bg-gray-200"
        >
          {seasonOptions.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>

        <select
          value={selectedYear}
          onChange={(e) => setSelectedYear(Number(e.target.value))}
          className="px-4 py-2 rounded-lg bg-gray-200"
        >
          {yearOptions.map((y) => (
            <option key={y} value={y}>
              {y}년
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-wrap gap-3 mb-10">
        {genresList.map((g) => (
          <button
            key={g}
            onClick={() => toggleGenre(g)}
            className={`px-4 py-2 rounded-full ${
              selectedGenres.includes(g) ? "bg-red-600 text-white" : "bg-gray-200 hover:bg-gray-300"
            }`}
          >
            {g}
          </button>
        ))}
      </div>

      {isLoading && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-6">
          {Array.from({ length: 8 }).map((_, i) => (
            <GenreSkeleton key={i} />
          ))}
        </div>
      )}

      {!isLoading && currentItems.length === 0 && (
        <p className="text-center text-gray-400">선택한 조건의 작품이 없습니다.</p>
      )}

      {!isLoading && currentItems.length > 0 && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-6">
            {currentItems.map((anime) => (
              <div
                key={anime._id}
                onClick={() => navigate(`/AnimeDetail/${anime._id}`)}
                className="bg-white rounded-2xl shadow-lg cursor-pointer hover:shadow-xl"
              >
                <img src={anime.image.large} alt={anime.title} className="h-52 w-full object-cover rounded-t-2xl" />
                <div className="p-4">
                  <div className="h-12">
                    <h3 className="font-bold mb-2 line-clamp-2">{anime.title}</h3>
                  </div>

                  <div className="flex flex-wrap gap-1 mb-2 items-center h-7">
                    {anime.genres?.slice(0, 3).map((g, i) => (
                      <span key={i} className="text-xs px-2 py-0.5 bg-red-100 text-red-600 rounded-full">
                        {g}
                      </span>
                    ))}

                    {anime.genres.length > 3 && (
                      <span className="px-[5px] py-1 bg-red-100 text-red-700 rounded-full text-xs font-semibold">
                        +{anime.genres.length - 3}
                      </span>
                    )}
                  </div>

                  <div className="text-sm text-gray-400 flex justify-between h-7">
                    {/* 연도 */}
                    <div className="flex items-center gap-1">
                      <Calendar size={14} />
                      <span>{anime.startDate.year ? anime.startDate.year + "년" : "미정"}</span>
                    </div>

                    {/* 스튜디오 */}
                    <div className="flex items-center gap-1 min-w-0">
                      <Building size={14} className="shrink-0" />
                      <span className="truncate max-w-[5rem] min-w-0">{anime.studio}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <Pagination
            currentPage={currentPage}
            totalItems={filteredList.length}
            itemsPerPage={itemsPerPage}
            onPageChange={setCurrentPage}
          />
        </>
      )}
    </div>
  );
};

export default GenreSection;
