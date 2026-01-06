import React, { useEffect, useState, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Calendar, Building } from "lucide-react";

/* =======================
   상수
======================= */
const genresList = ["액션", "로맨스", "판타지", "SF", "일상", "스포츠"];

const seasonOptions = [
  { label: "겨울 (1분기)", value: "winter" },
  { label: "봄 (2분기)", value: "spring" },
  { label: "여름 (3분기)", value: "summer" },
  { label: "가을 (4분기)", value: "fall" },
];

const currentYear = new Date().getFullYear();
const yearOptions = [];
for (let y = currentYear; y >= 2010; y--) {
  yearOptions.push(y);
}

// 현재 계절 계산
const getCurrentSeason = () => {
  const month = new Date().getMonth() + 1;
  if (month >= 1 && month <= 3) return "winter";
  if (month >= 4 && month <= 6) return "spring";
  if (month >= 7 && month <= 9) return "summer";
  return "fall";
};

/* =======================
   Skeleton
======================= */
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

/* =======================
   Component
======================= */
const GenreSection = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  /* ---------- URL 기반 초기값 ---------- */
  const initialGenres = useMemo(() => {
    const g = searchParams.get("genre");
    return g ? g.split(",") : [];
  }, []);

  const initialSeason = searchParams.get("season") || getCurrentSeason();
  const initialYear = Number(searchParams.get("year")) || currentYear;

  /* ---------- 상태 ---------- */
  const [isLoading, setIsLoading] = useState(true);
  const [animeList, setAnimeList] = useState([]);
  const [selectedGenres, setSelectedGenres] = useState(initialGenres);
  const [selectedSeason, setSelectedSeason] = useState(initialSeason);
  const [selectedYear, setSelectedYear] = useState(initialYear);

  /* ---------- 페이지네이션 ---------- */
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 12;
  const maxPageButtons = 5;

  /* ---------- 번역 ---------- */
  const translateText = async (text) => {
    try {
      const res = await fetch("http://localhost:3000/service/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, target: "ko" }),
      });
      const data = await res.json();
      return data.translatedText || text;
    } catch {
      return text;
    }
  };

  /* ---------- 데이터 로드 ---------- */
  useEffect(() => {
    const fetchAnime = async () => {
      setIsLoading(true);
      setCurrentPage(1);

      try {
        const url = `https://api.jikan.moe/v4/seasons/${selectedYear}/${selectedSeason}`;

        const res = await fetch(url);
        const json = await res.json();

        const data = await Promise.all(
          json.data.map(async (anime) => ({
            id: anime.mal_id,
            title: anime.title_japanese ? await translateText(anime.title_japanese) : anime.title,
            synopsis: anime.synopsis ? await translateText(anime.synopsis) : "줄거리 정보 없음",
            image: anime.images?.jpg?.image_url,
            genre: anime.genres ? await Promise.all(anime.genres.map((g) => translateText(g.name))) : [],
            startDate: anime.aired?.from?.slice(0, 10) || "미정",
            studio: anime.studios?.[0]?.name || "미정",
          }))
        );

        setAnimeList(data);
      } catch (e) {
        console.error(e);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAnime();
  }, [selectedSeason, selectedYear]);

  /* ---------- URL 동기화 ---------- */
  useEffect(() => {
    const params = {};
    if (selectedGenres.length) params.genre = selectedGenres.join(",");
    if (selectedSeason) params.season = selectedSeason;
    if (selectedYear) params.year = selectedYear;
    setSearchParams(params);
  }, [selectedGenres, selectedSeason, selectedYear]);

  /* ---------- 장르 토글 ---------- */
  const toggleGenre = (genre) => {
    setCurrentPage(1);
    setSelectedGenres((prev) => (prev.includes(genre) ? prev.filter((g) => g !== genre) : [...prev, genre]));
  };

  /* ---------- 필터링 ---------- */
  const filteredList =
    selectedGenres.length === 0 ? animeList : animeList.filter((a) => a.genre.some((g) => selectedGenres.includes(g)));

  /* ---------- 페이지네이션 계산 ---------- */
  const totalPages = Math.ceil(filteredList.length / itemsPerPage);
  const currentItems = filteredList.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const getPageNumbers = () => {
    const pages = [];
    let start = Math.max(currentPage - 2, 1);
    let end = Math.min(start + maxPageButtons - 1, totalPages);

    if (start > 1) {
      pages.push(1);
      if (start > 2) pages.push("...");
    }

    for (let i = start; i <= end; i++) pages.push(i);

    if (end < totalPages) {
      if (end < totalPages - 1) pages.push("...");
      pages.push(totalPages);
    }

    return pages;
  };

  /* =======================
     Render
  ======================= */
  return (
    <div className="container mx-auto px-4 py-20">
      <h1 className="text-3xl font-bold mb-6">장르 · 분기별 작품</h1>

      {/* 분기 / 연도 */}
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

      {/* 장르 */}
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

      {/* 로딩 */}
      {isLoading && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-6">
          {Array.from({ length: 8 }).map((_, i) => (
            <AnimeCardSkeleton key={i} />
          ))}
        </div>
      )}

      {/* 결과 */}
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
                {/* 이미지 영역 */}
                <div className="h-52 w-full overflow-hidden rounded-t-2xl bg-gray-200">
                  <img src={anime.image} alt={anime.title} className="w-full h-full object-cover" />
                </div>

                {/* 텍스트 영역 */}
                <div className="p-4">
                  <h3 className="font-bold mb-2 line-clamp-1">{anime.title}</h3>
                  <div className="flex flex-wrap gap-1 mb-2">
                    {anime.genre.map((g, i) => (
                      <span key={i} className="text-xs px-2 py-0.5 bg-red-100 text-red-600 rounded-full">
                        {g}
                      </span>
                    ))}
                  </div>
                  <div className="text-sm text-gray-400 flex justify-between">
                    <div className="flex items-center gap-1">
                      <Calendar size={14} className="text-gray-400" />
                      <span>{anime.startDate.slice(0, 4)}년</span>
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

          {/* 페이지네이션 */}
          {totalPages > 1 && (
            <div className="flex justify-center mt-10 gap-2 flex-wrap">
              {getPageNumbers().map((p, i) =>
                p === "..." ? (
                  <span key={i} className="px-2 text-gray-400">
                    …
                  </span>
                ) : (
                  <button
                    key={p}
                    onClick={() => setCurrentPage(p)}
                    className={`px-3 py-1 rounded ${currentPage === p ? "bg-red-600 text-white" : "bg-gray-200"}`}
                  >
                    {p}
                  </button>
                )
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default GenreSection;
