import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Calendar, Building } from "lucide-react";
import Pagination from "../../Components/Pagination/Pagination";
import { fetchAniList } from "../../Components/items/AniListItem.jsx";
import { GenreSkeleton } from "../../Components/items/Skeleton";
import Select from "react-select";

const genresList = ["액션", "로맨스", "판타지", "SF", "일상", "스포츠", "모험"];
const genreOptions = genresList.map((g) => ({ value: g, label: g }));

const customStyles = {
  control: (provided) => ({
    ...provided,
    minHeight: "40px",
    borderRadius: "9999px", // 둥근 테두리
    borderColor: "#ccc",
    boxShadow: "none",
    paddingLeft: "5px",
    paddingRight: "8px",
    cursor: "pointer",
    "&:hover": {
      borderColor: "#ccc",
    },
  }),
  menu: (provided) => ({
    ...provided,
    borderRadius: "12px",
    marginTop: 4,
    padding: 4,
  }),
  option: (provided, state) => ({
    ...provided,
    borderRadius: "9999px",
    padding: "8px 16px",
    margin: "4px 0",
    backgroundColor: state.isSelected
      ? "#dc2626" // bg-red-600
      : state.isFocused
        ? "#e5e7eb" // bg-gray-300
        : "#e5e7eb40", // bg-gray-200 반투명 느낌
    color: state.isSelected ? "#fff" : "#111827", // text-white / text-gray-900
    cursor: "pointer",
  }),
  multiValue: (provided) => ({
    ...provided,
    backgroundColor: "#dc2626", // 선택된 태그 빨강
    borderRadius: "9999px",
    padding: "3px 8px",
    color: "#fff",
  }),
  multiValueLabel: (provided) => ({
    ...provided,
    color: "#fff",
    fontWeight: 500,
  }),
  multiValueRemove: (provided) => ({
    ...provided,
    color: "#111827",
    ":hover": {
      backgroundColor: "transparent", // 배경 없앰
      color: "#111827", // 검은색
    },
  }),
};

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
  const [selectedName, setSelectedName] = useState(searchParams.get("name") ?? "");
  const [animeList, setAnimeList] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [debouncedName, setDebouncedName] = useState(null);
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
    params.name = selectedName;
    setSearchParams(params);
  }, [selectedGenres, selectedSeason, selectedYear, debouncedName]);

  /* ---------- 필터 ---------- */
  const filteredList = useMemo(() => {
    return animeList.filter((a) => {
      const matchesGenre = !selectedGenres.length || a.genres.some((g) => selectedGenres.includes(g));
      const matchesName = !debouncedName || a.title.toLowerCase().includes(debouncedName.toLowerCase());
      return matchesGenre && matchesName;
    });
  }, [animeList, selectedGenres, debouncedName]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedName(selectedName);
    }, 300);

    return () => clearTimeout(timer);
  }, [selectedName]);

  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedName, selectedGenres]);

  const currentItems = filteredList.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return (
    <div className="container mx-auto px-4 py-20">
      <h1 className="text-3xl font-bold mb-6">장르 · 분기별 작품</h1>

      <div className="flex gap-4 mb-6 flex-wrap justify-between">
        <div className="flex gap-4">
          <select
            value={selectedSeason}
            onChange={(e) => setSelectedSeason(e.target.value)}
            className="px-4 py-2 rounded-2xl bg-white border border-gray-400 hover:cursor-pointer"
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
            className="px-4 py-2 rounded-2xl bg-white border border-gray-400 hover:cursor-pointer"
          >
            {yearOptions.map((y) => (
              <option key={y} value={y}>
                {y}년
              </option>
            ))}
          </select>
        </div>

        <input
          className="px-4 py-2 rounded-2xl w-80 bg-white border border-gray-400 hover:cursor-pointer"
          placeholder="Search"
          value={selectedName}
          onChange={(e) => setSelectedName(e.target.value)}
        ></input>
      </div>

      <div className="flex flex-wrap gap-3 mb-10">
        <Select
          isMulti
          options={genreOptions}
          value={genreOptions.filter((option) => selectedGenres.includes(option.value))}
          placeholder="장르선택"
          onChange={(selectedOptions) => {
            const selected = selectedOptions ? selectedOptions.map((option) => option.value) : [];
            setSelectedGenres(selected);
            setCurrentPage(1);
          }}
          styles={customStyles}
        />
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
                      <span>{anime.startDate ? anime.startDate + "년" : "미정"}</span>
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
