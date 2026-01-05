import React, { useEffect, useState } from "react";

// Skeleton 카드
const AnimeCardSkeleton = () => (
  <div className="rounded-2xl bg-white shadow-lg overflow-hidden animate-pulse">
    <div className="h-48 bg-gray-200" />
    <div className="p-4 space-y-2">
      <div className="h-5 bg-gray-200 rounded w-3/4" />
      <div className="h-4 bg-gray-200 rounded w-full" />
      <div className="h-4 bg-gray-200 rounded w-5/6" />
      <div className="h-3 bg-gray-200 rounded w-1/3 mt-2" />
    </div>
  </div>
);

const AiringAnimePage = () => {
  const [schedule, setSchedule] = useState({});
  const [selectedDay, setSelectedDay] = useState("전체");
  const [isLoading, setIsLoading] = useState(true);
  const [translated, setTranslated] = useState({});

  const dayMap = {
    Mondays: "월",
    Tuesdays: "화",
    Wednesdays: "수",
    Thursdays: "목",
    Fridays: "금",
    Saturdays: "토",
    Sundays: "일",
  };

  const translateText = async (text) => {
    try {
      const res = await fetch("http://localhost:3000/service/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, target: "ko" }),
      });
      const data = await res.json();
      return data.translatedText;
    } catch (err) {
      console.error("Translation error:", err);
      return text;
    }
  };

  useEffect(() => {
    const fetchAnimeSchedule = async () => {
      try {
        const res = await fetch("https://api.jikan.moe/v4/seasons/now");
        const json = await res.json();

        const days = { 월: [], 화: [], 수: [], 목: [], 금: [], 토: [], 일: [] };

        // 번역 + 데이터 가공 병렬 처리
        const translatedList = await Promise.all(
          json.data.map(async (anime) => {
            const day = dayMap[anime.broadcast?.day];
            if (day) days[day].push(anime);

            const titleKR = anime.title_japanese ? await translateText(anime.title_japanese) : anime.title;

            const synopsisKR = anime.synopsis ? await translateText(anime.synopsis) : "";

            return {
              id: anime.mal_id,
              title: titleKR,
              synopsis: synopsisKR,
            };
          })
        );

        const newTranslated = {};
        translatedList.forEach((item) => {
          newTranslated[item.id] = {
            title: item.title,
            synopsis: item.synopsis,
          };
        });

        days["전체"] = Object.values(days).flat();

        setSchedule(days);
        setTranslated(newTranslated);
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAnimeSchedule();
  }, []);

  const days = ["전체", "월", "화", "수", "목", "금", "토", "일"];

  return (
    <div className="container mx-auto px-4 py-20">
      <h1 className="text-3xl font-bold mb-8 text-left">방영중 애니</h1>

      {/* 요일 선택 버튼 */}
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

      {/* 카드 그리드 */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-6">
        {isLoading
          ? // Skeleton 8개 출력
            Array.from({ length: 8 }).map((_, i) => <AnimeCardSkeleton key={i} />)
          : schedule[selectedDay].map((anime) => (
              <div
                key={anime.mal_id}
                className="bg-white rounded-2xl overflow-hidden shadow-lg hover:shadow-2xl transition"
              >
                <img src={anime.images.jpg.image_url} alt={anime.title} className="w-full h-48 object-cover" />
                <div className="p-4">
                  <h3 className="font-bold text-lg mb-1">{translated[anime.mal_id]?.title || anime.title}</h3>
                  <div className="flex justify-between text-sm text-gray-400">
                    <span>{anime.aired.from?.slice(0, 4) || "?"}년</span>
                    <span>{anime.episodes ? "화" : "미방"}</span>
                  </div>
                </div>
              </div>
            ))}
      </div>
    </div>
  );
};

export default AiringAnimePage;
