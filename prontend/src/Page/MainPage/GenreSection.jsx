import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Building, Calendar, Search, SlidersHorizontal } from "lucide-react";
import Select from "react-select";
import Pagination from "../../Components/Pagination/Pagination";
import { fetchAniList, getCachedAniList } from "../../Components/items/AniListItem.jsx";
import { GenreSkeleton } from "../../Components/items/Skeleton";

const genresList = ["액션", "로맨스", "판타지", "SF", "일상", "스포츠", "모험", "코미디", "드라마", "미스터리"];
const genreOptions = genresList.map((genre) => ({ value: genre, label: genre }));

const seasonOptions = [
  { label: "겨울 1분기", value: "WINTER" },
  { label: "봄 2분기", value: "SPRING" },
  { label: "여름 3분기", value: "SUMMER" },
  { label: "가을 4분기", value: "FALL" },
];

const selectStyles = {
  control: (base, state) => ({
    ...base,
    minHeight: 46,
    width: "100%",
    background: "rgba(24, 24, 22, 0.92)",
    borderColor: state.isFocused ? "#f59e0b" : "rgba(245, 241, 232, 0.16)",
    borderRadius: 8,
    boxShadow: state.isFocused ? "0 0 0 3px rgba(245, 158, 11, 0.16)" : "none",
    color: "#f5f1e8",
    cursor: "pointer",
    transition: "border-color 160ms ease, box-shadow 160ms ease, transform 160ms ease",
    ":hover": {
      borderColor: "#f59e0b",
      transform: "translateY(-1px)",
    },
  }),
  valueContainer: (base) => ({
    ...base,
    padding: "4px 10px",
    gap: 6,
  }),
  input: (base) => ({
    ...base,
    color: "#f5f1e8",
  }),
  placeholder: (base) => ({
    ...base,
    color: "rgba(245, 241, 232, 0.54)",
  }),
  menu: (base) => ({
    ...base,
    overflow: "hidden",
    background: "#181816",
    border: "1px solid rgba(245, 241, 232, 0.14)",
    borderRadius: 8,
    boxShadow: "0 18px 48px rgba(0, 0, 0, 0.45)",
    zIndex: 30,
  }),
  menuList: (base) => ({
    ...base,
    padding: 6,
  }),
  option: (base, state) => ({
    ...base,
    marginBottom: 4,
    borderRadius: 6,
    background: state.isSelected ? "#dc2626" : state.isFocused ? "rgba(245, 158, 11, 0.14)" : "transparent",
    color: state.isSelected ? "#fff" : "#f5f1e8",
    cursor: "pointer",
    transition: "background-color 140ms ease, color 140ms ease",
  }),
  multiValue: (base) => ({
    ...base,
    alignItems: "center",
    background: "rgba(220, 38, 38, 0.92)",
    borderRadius: 999,
    paddingLeft: 6,
  }),
  multiValueLabel: (base) => ({
    ...base,
    color: "#fff",
    fontWeight: 700,
  }),
  multiValueRemove: (base) => ({
    ...base,
    borderRadius: 999,
    color: "#fff",
    ":hover": {
      background: "rgba(0, 0, 0, 0.18)",
      color: "#fff",
    },
  }),
  indicatorSeparator: () => ({ display: "none" }),
  dropdownIndicator: (base) => ({
    ...base,
    color: "rgba(245, 241, 232, 0.65)",
    ":hover": { color: "#f59e0b" },
  }),
  clearIndicator: (base) => ({
    ...base,
    color: "rgba(245, 241, 232, 0.58)",
    ":hover": { color: "#f59e0b" },
  }),
};

const currentYear = new Date().getFullYear();
const yearOptions = Array.from({ length: currentYear - 2009 }, (_, i) => currentYear - i);

const getCurrentSeason = () => {
  const month = new Date().getMonth() + 1;
  if (month <= 3) return "WINTER";
  if (month <= 6) return "SPRING";
  if (month <= 9) return "SUMMER";
  return "FALL";
};

const GenreSection = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialSeason = searchParams.get("season") || getCurrentSeason();
  const initialYear = Number(searchParams.get("year")) || currentYear;
  const initialCache = getCachedAniList("genre", initialSeason, initialYear) || [];

  const [selectedGenres, setSelectedGenres] = useState(searchParams.get("genres")?.split(",") || []);
  const [selectedSeason, setSelectedSeason] = useState(initialSeason);
  const [selectedYear, setSelectedYear] = useState(initialYear);
  const [selectedName, setSelectedName] = useState(searchParams.get("name") ?? "");
  const [animeList, setAnimeList] = useState(initialCache);
  const [isLoading, setIsLoading] = useState(initialCache.length === 0);
  const [currentPage, setCurrentPage] = useState(1);
  const [debouncedName, setDebouncedName] = useState(searchParams.get("name") ?? "");
  const itemsPerPage = 12;

  useEffect(() => {
    const fetchAnime = async () => {
      const cached = getCachedAniList("genre", selectedSeason, selectedYear) || [];
      setAnimeList(cached);
      setIsLoading(cached.length === 0);
      setCurrentPage(1);

      try {
        const processed = await fetchAniList("genre", selectedSeason, selectedYear);
        setAnimeList(processed || []);
      } catch (error) {
        console.error(error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAnime();
  }, [selectedSeason, selectedYear]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedName(selectedName);
    }, 300);

    return () => clearTimeout(timer);
  }, [selectedName]);

  useEffect(() => {
    const params = {};
    if (selectedGenres.length) params.genres = selectedGenres.join(",");
    params.season = selectedSeason;
    params.year = selectedYear;
    if (debouncedName) params.name = debouncedName;
    setSearchParams(params);
  }, [selectedGenres, selectedSeason, selectedYear, debouncedName, setSearchParams]);

  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedName, selectedGenres]);

  const filteredList = useMemo(() => {
    return animeList.filter((anime) => {
      const matchesGenre = !selectedGenres.length || anime.genres?.some((genre) => selectedGenres.includes(genre));
      const matchesName = !debouncedName || anime.title?.toLowerCase().includes(debouncedName.toLowerCase());
      return matchesGenre && matchesName;
    });
  }, [animeList, selectedGenres, debouncedName]);

  const currentItems = filteredList.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return (
    <section className="mx-auto min-h-screen max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-7 flex flex-col gap-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-amber-400">
          <SlidersHorizontal size={16} />
          <span>분기별 애니 탐색</span>
        </div>
        <h1 className="text-3xl font-bold tracking-normal text-stone-50 sm:text-4xl">장르별 애니메이션</h1>
      </div>

      <div className="mb-8 rounded-lg border border-stone-100/10 bg-[#181816]/90 p-4 shadow-2xl shadow-black/30 backdrop-blur sm:p-5">
        <div className="grid gap-3 lg:grid-cols-[160px_140px_minmax(240px,1fr)_minmax(260px,1.2fr)]">
          <label className="group flex flex-col gap-2">
            <span className="text-xs font-bold uppercase tracking-wide text-stone-400">Season</span>
            <select
              value={selectedSeason}
              onChange={(e) => setSelectedSeason(e.target.value)}
              className="h-[46px] rounded-lg border border-stone-100/15 bg-[#10100f] px-3 text-sm font-semibold text-stone-100 outline-none transition duration-200 hover:-translate-y-0.5 hover:border-amber-500 focus:border-amber-500 focus:ring-4 focus:ring-amber-500/15"
            >
              {seasonOptions.map((season) => (
                <option key={season.value} value={season.value}>
                  {season.label}
                </option>
              ))}
            </select>
          </label>

          <label className="group flex flex-col gap-2">
            <span className="text-xs font-bold uppercase tracking-wide text-stone-400">Year</span>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="h-[46px] rounded-lg border border-stone-100/15 bg-[#10100f] px-3 text-sm font-semibold text-stone-100 outline-none transition duration-200 hover:-translate-y-0.5 hover:border-amber-500 focus:border-amber-500 focus:ring-4 focus:ring-amber-500/15"
            >
              {yearOptions.map((year) => (
                <option key={year} value={year}>
                  {year}년
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-2">
            <span className="text-xs font-bold uppercase tracking-wide text-stone-400">Title</span>
            <div className="flex h-[46px] items-center gap-2 rounded-lg border border-stone-100/15 bg-[#10100f] px-3 transition duration-200 focus-within:border-amber-500 focus-within:ring-4 focus-within:ring-amber-500/15 hover:-translate-y-0.5 hover:border-amber-500">
              <Search size={17} className="shrink-0 text-stone-500" />
              <input
                className="h-full min-w-0 flex-1 bg-transparent text-sm font-semibold text-stone-100 outline-none placeholder:text-stone-500"
                placeholder="작품명 검색"
                value={selectedName}
                onChange={(e) => setSelectedName(e.target.value)}
              />
            </div>
          </label>

          <label className="flex flex-col gap-2">
            <span className="text-xs font-bold uppercase tracking-wide text-stone-400">Genre</span>
            <Select
              isMulti
              options={genreOptions}
              value={genreOptions.filter((option) => selectedGenres.includes(option.value))}
              placeholder="장르 선택"
              onChange={(selectedOptions) => {
                const selected = selectedOptions ? selectedOptions.map((option) => option.value) : [];
                setSelectedGenres(selected);
                setCurrentPage(1);
              }}
              styles={selectStyles}
            />
          </label>
        </div>
      </div>

      {isLoading && (
        <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 md:grid-cols-4">
          {Array.from({ length: 8 }).map((_, index) => (
            <GenreSkeleton key={index} />
          ))}
        </div>
      )}

      {!isLoading && currentItems.length === 0 && (
        <div className="rounded-lg border border-stone-100/10 bg-[#181816]/80 py-16 text-center text-stone-400">
          선택한 조건에 맞는 작품이 없습니다.
        </div>
      )}

      {!isLoading && currentItems.length > 0 && (
        <>
          <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 md:grid-cols-4">
            {currentItems.map((anime, index) => (
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
                    className="h-52 w-full object-cover transition duration-500 group-hover:scale-105"
                    loading={index < 8 ? "eager" : "lazy"}
                    decoding="async"
                  />
                </div>
                <div className="p-4">
                  <div className="h-12">
                    <h3 className="mb-2 line-clamp-2 font-bold text-stone-50">{anime.title}</h3>
                  </div>

                  <div className="mb-3 flex h-7 flex-wrap items-center gap-1 overflow-hidden">
                    {anime.genres?.slice(0, 3).map((genre) => (
                      <span key={genre} className="rounded-full bg-red-500/15 px-2 py-0.5 text-xs text-red-200">
                        {genre}
                      </span>
                    ))}

                    {anime.genres?.length > 3 && (
                      <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-semibold text-amber-200">
                        +{anime.genres.length - 3}
                      </span>
                    )}
                  </div>

                  <div className="flex h-7 justify-between gap-2 text-sm text-stone-400">
                    <div className="flex min-w-0 items-center gap-1">
                      <Calendar size={14} className="shrink-0 text-amber-400" />
                      <span className="truncate">{anime.startDate || "미정"}</span>
                    </div>

                    <div className="flex min-w-0 items-center gap-1">
                      <Building size={14} className="shrink-0 text-amber-400" />
                      <span className="truncate">
                        {Array.isArray(anime.studio) ? anime.studio[0] : anime.studio || "미정"}
                      </span>
                    </div>
                  </div>
                </div>
              </button>
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
    </section>
  );
};

export default GenreSection;
