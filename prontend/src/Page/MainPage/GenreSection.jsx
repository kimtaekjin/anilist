import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Calendar, Building } from "lucide-react";
import Pagination from "../../Components/Pagination/Pagination";
import { fetchGenreAnime } from "../../Components/items/aniListQuery";

const AnimeCardSkeleton = () => (
  <div className="bg-white rounded-2xl shadow-lg overflow-hidden animate-pulse">
    {/* 이미지 자리 */}
    <div className="h-52 w-full bg-gray-200 rounded-t-2xl" />

    {/* 텍스트 자리 */}
    <div className="p-4 space-y-2">
      <div className="h-5 w-3/4 bg-gray-300 rounded" />
      <div className="h-4 w-full bg-gray-200 rounded" />
      <div className="h-4 w-5/6 bg-gray-200 rounded" />

      {/* 장르 태그 자리 */}
      <div className="flex flex-wrap gap-1 mt-2">
        <div className="h-5 w-16 bg-gray-200 rounded-full" />
        <div className="h-5 w-12 bg-gray-200 rounded-full" />
      </div>

      {/* 날짜 + 스튜디오 자리 */}
      <div className="flex justify-between mt-2 text-sm text-gray-400">
        <div className="h-4 w-12 bg-gray-200 rounded" />
        <div className="h-4 w-16 bg-gray-200 rounded" />
      </div>
    </div>
  </div>
);

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

const CACHE_DURATION = 24 * 60 * 60 * 1000;

const GenreSection = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [selectedGenres, setSelectedGenres] = useState(searchParams.get("genre")?.split(",") || []);
  const [selectedSeason, setSelectedSeason] = useState(searchParams.get("season") || getCurrentSeason());
  const [selectedYear, setSelectedYear] = useState(Number(searchParams.get("year")) || currentYear);

  const [animeList, setAnimeList] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 12;

  /* ---------- 데이터 로드 ---------- */

  useEffect(() => {
    const fetchAnime = async () => {
      setIsLoading(true);
      setCurrentPage(1);

      const now = Date.now();
      const cacheKey = `genreAnime:${selectedSeason}:${selectedYear}`;

      try {
        const cached = JSON.parse(localStorage.getItem(cacheKey));

        if (cached && now - cached.updated < CACHE_DURATION) {
          setAnimeList(cached.data);
          setIsLoading(false);
          return;
        }

        const processed = await fetchGenreAnime(selectedSeason, selectedYear);

        setAnimeList(processed);

        localStorage.setItem(cacheKey, JSON.stringify({ data: processed, updated: now }));
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
    if (selectedGenres.length) params.genre = selectedGenres.join(",");
    params.season = selectedSeason;
    params.year = selectedYear;
    setSearchParams(params);
  }, [selectedGenres, selectedSeason, selectedYear, setSearchParams]);

  /* ---------- 필터 ---------- */
  const filteredList = useMemo(() => {
    if (!selectedGenres.length) return animeList;
    return animeList.filter((a) => a.genre.some((g) => selectedGenres.includes(g)));
  }, [animeList, selectedGenres]);

  const currentItems = filteredList.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const toggleGenre = (genre) => {
    setCurrentPage(1);
    setSelectedGenres((prev) => (prev.includes(genre) ? prev.filter((g) => g !== genre) : [...prev, genre]));
  };

  /* =======================
     Render
  ======================= */
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
            <AnimeCardSkeleton key={i} />
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
                key={anime.id}
                onClick={() => navigate(`/AnimeDetail/${anime.id}`)}
                className="bg-white rounded-2xl shadow-lg cursor-pointer hover:shadow-xl"
              >
                <img src={anime.image} alt={anime.title} className="h-52 w-full object-cover rounded-t-2xl" />
                <div className="p-4">
                  <div className="h-12">
                    <h3 className="font-bold mb-2 line-clamp-2">{anime.title}</h3>
                  </div>

                  <div className="flex flex-wrap gap-1 mb-2 items-center h-7">
                    {anime.genre.slice(0, 3).map((g, i) => (
                      <span key={i} className="text-xs px-2 py-0.5 bg-red-100 text-red-600 rounded-full">
                        {g}
                      </span>
                    ))}

                    {anime.genre.length > 3 && (
                      <span className="px-[5px] py-1 bg-red-100 text-red-700 rounded-full text-xs font-semibold">
                        +{anime.genre.length - 3}
                      </span>
                    )}
                  </div>

                  <div className="text-sm text-gray-400 flex justify-between h-7">
                    {/* 연도 */}
                    <div className="flex items-center gap-1">
                      <Calendar size={14} />
                      <span>{anime.startYear}년</span>
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
