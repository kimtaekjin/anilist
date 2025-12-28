import React, { useRef } from "react";
import anime1 from "../asset/anime1.jpg";
import anime2 from "../asset/anime2.jpg";
import anime3 from "../asset/anime3.jpg";
import anime4 from "../asset/anime4.jpg";
import anime5 from "../asset/anime5.jpg";
import anime6 from "../asset/anime6.jpg";

const animeList = [
  { id: 1, title: "애니1", image: anime1, episode: "2", ReleaseYear: 2025 },
  { id: 2, title: "애니2", image: anime2, episode: "2", ReleaseYear: 2025 },
  { id: 3, title: "애니3", image: anime3, episode: "2", ReleaseYear: 2025 },
  { id: 4, title: "애니4", image: anime4, episode: "2", ReleaseYear: 2025 },
  { id: 5, title: "애니5", image: anime5, episode: "2", ReleaseYear: 2025 },
  { id: 6, title: "애니6", image: anime6, episode: "2", ReleaseYear: 2025 },
];

const MainPage = () => {
  const scrollRef = useRef(null);

  const scrollLeft = () => {
    scrollRef.current.scrollBy({ left: -250, behavior: "smooth" });
  };

  const scrollRight = () => {
    scrollRef.current.scrollBy({ left: 250, behavior: "smooth" });
  };

  return (
    <div className="container mx-auto px-4 py-8 my-12 relative">
      <h2 className="text-2xl font-bold mb-4">추천 애니</h2>

      {/* 좌우 버튼 */}
      <button
        onClick={scrollLeft}
        className="absolute left-0 top-1/2 -translate-y-1/2 bg-black bg-opacity-50 text-white p-2 rounded-full z-10"
      >
        ◀
      </button>
      <button
        onClick={scrollRight}
        className="absolute right-0 top-1/2 -translate-y-1/2 bg-black bg-opacity-50 text-white p-2 rounded-full z-10"
      >
        ▶
      </button>

      {/* 가로 스크롤 영역 */}
      <div ref={scrollRef} className="flex space-x-4 overflow-x-hidden scrollbar-hide scroll-smooth">
        {animeList.map((anime) => (
          <div key={anime.id} className="min-w-[200px] flex-shrink-0 rounded-2xl overflow-hidden shadow-lg bg-white">
            {/* 이미지 */}
            <img src={anime.image} alt={anime.title} className="w-full h-60 object-cover" />

            {/* 제목 & 소개 */}
            <div className="p-4">
              <h3 className="text-lg font-bold mb-1">{anime.title}</h3>
              <div className="flex justify-between">
                <div>
                  <p className="text-sm text-gray-400">{anime.ReleaseYear}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-400">{anime.episode}</p>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default MainPage;
