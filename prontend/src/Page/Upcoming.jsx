// pages/UpcomingAnimePage.jsx
import React from "react";

import anime1 from "../asset/anime1.jpg";
import anime2 from "../asset/anime2.jpg";
import anime3 from "../asset/anime3.jpg";
import anime4 from "../asset/anime4.jpg";
import anime5 from "../asset/anime5.jpg";
import anime6 from "../asset/anime6.jpg";

// 방영 예정 애니 데이터 (임시)
const upcomingList = [
  {
    id: 1,
    title: "제목123123",
    image: anime1,
    startDate: "2026-01-05",
    studio: "스튜디오A",
    source: "노벨 소설",
    genre: ["배틀", "로맨스"],
    description: "어쩌구저쩌구 애니메이션",
  },
  {
    id: 2,
    title: "제목123123",
    image: anime2,
    startDate: "2026-01-07",
    studio: "스튜디오B",
    source: "노벨 소설",
    genre: ["배틀", "로맨스"],
    description: "어쩌구저쩌구 애니메이션",
  },
  {
    id: 3,
    title: "제목123123",
    image: anime3,
    startDate: "2026-01-10",
    studio: "스튜디오C",
    source: "노벨 소설",
    genre: ["배틀", "로맨스"],
    description: "어쩌구저쩌구 애니메이션",
  },
  {
    id: 4,
    title: "제목123123",
    image: anime4,
    startDate: "2026-01-15",
    studio: "스튜디오D",
    source: "만화",
    genre: ["배틀", "로맨스"],
    description: "어쩌구저쩌구 애니메이션",
  },
  {
    id: 5,
    title: "제목123123",
    image: anime5,
    startDate: "2026-01-20",
    studio: "스튜디오E",
    source: "만화",
    genre: ["배틀", "로맨스"],
    description: "이번 시즌 기대작 5",
  },
  {
    id: 6,
    title: "제목123123",
    image: anime6,
    startDate: "2026-01-25",
    studio: "스튜디오F",
    source: "만화",
    genre: ["배틀", "로맨스"],
    description: "이번 시즌 기대작 6",
  },
];

const Upcoming = () => {
  return (
    <div className="container mx-auto px-4 py-20">
      <h1 className="text-3xl font-extrabold mb-12 ">방영 예정 작품</h1>

      {/* 작품 리스트 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {upcomingList.length === 0 ? (
          <p className="text-gray-400 col-span-full">방영 예정 작품이 없습니다.</p>
        ) : (
          upcomingList.map((anime) => (
            <div
              key={anime.id}
              className="bg-gradient-to-b from-gray-100 to-white rounded-3xl shadow-xl overflow-hidden transform hover:scale-105 transition-all duration-300"
            >
              {/* 이미지 */}
              <img src={anime.image} alt={anime.title} className="w-full h-60 object-cover border-b border-gray-200" />

              {/* 정보 영역 */}
              <div className="p-6">
                <h3 className="text-xl font-bold mb-2 text-gray-800">{anime.title}</h3>

                <div className="flex flex-wrap gap-2 mb-3">
                  {anime.genre.map((g, index) => (
                    <span key={index} className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-xs font-semibold">
                      {g}
                    </span>
                  ))}
                </div>

                <p className="text-gray-500 text-sm mb-2">{anime.description}</p>

                <div className="flex justify-between text-gray-400 text-sm mt-4 border-t border-gray-200 pt-2">
                  <span>방영 시작: {anime.startDate}</span>
                  <span>제작: {anime.studio}</span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default Upcoming;
