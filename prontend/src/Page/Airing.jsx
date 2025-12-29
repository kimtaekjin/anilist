// pages/AiringAnimePage.jsx
import React, { useEffect, useState } from "react";

const AiringAnimePage = () => {
  const [schedule, setSchedule] = useState({});
  const [selectedDay, setSelectedDay] = useState("전체");
  const [isLoading, setIsLoading] = useState(true);

  // 요일 영어 → 한글 매핑
  const dayMap = {
    Mondays: "월",
    Tuesdays: "화",
    Wednesdays: "수",
    Thursdays: "목",
    Fridays: "금",
    Saturdays: "토",
    Sundays: "일",
  };

  useEffect(() => {
    fetch("https://api.jikan.moe/v4/seasons/now")
      .then((res) => res.json())
      .then((json) => {
        const days = { 월: [], 화: [], 수: [], 목: [], 금: [], 토: [], 일: [] };
        json.data.forEach((anime) => {
          const day = dayMap[anime.broadcast?.day];
          if (day) days[day].push(anime);
        });
        days["전체"] = Object.values(days).flat();
        setSchedule(days);
        setIsLoading(false);
      })
      .catch((err) => {
        console.error("API fetch error:", err);
        setIsLoading(false);
      });
  }, []);

  const days = ["전체", "월", "화", "수", "목", "금", "토", "일"];

  if (isLoading) return <div className="text-center py-20">데이터를 가져오는 중입니다...</div>;

  return (
    <div className="container mx-auto px-4 py-20">
      <h1 className="text-3xl font-bold mb-8">방영중 애니</h1>

      {/* 요일/전체 탭 */}
      <div className="flex space-x-4 mb-8 overflow-x-auto scrollbar-hide">
        {days.map((day) => (
          <button
            key={day}
            onClick={() => setSelectedDay(day)}
            className={`px-4 py-2 rounded-full font-medium ${
              selectedDay === day ? "bg-red-600 text-white" : "bg-gray-200 text-gray-700 hover:bg-gray-300"
            } transition`}
          >
            {day}
          </button>
        ))}
      </div>

      {/* 애니 리스트 */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-6">
        {schedule[selectedDay]?.length === 0 ? (
          <p className="text-gray-400 col-span-full">방영 애니가 없습니다.</p>
        ) : (
          schedule[selectedDay].map((anime) => (
            <div
              key={anime.mal_id}
              className="bg-white rounded-2xl overflow-hidden shadow-lg hover:shadow-2xl transition"
            >
              <img src={anime.images.jpg.image_url} alt={anime.title} className="w-full h-48 object-cover" />
              <div className="p-4">
                <h3 className="font-bold text-lg mb-1">{anime.title}</h3>
                <div className="flex justify-between text-sm text-gray-400">
                  <span>{anime.aired.from?.slice(0, 4) || "?"}년</span>
                  <span>{anime.episodes ?? "?"}화</span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default AiringAnimePage;
