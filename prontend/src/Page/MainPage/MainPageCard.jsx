import React, { useRef, useEffect } from "react";

function MainPageCard({ title, animeList }) {
  // const animeList = [
  //   {
  //     id: 1,
  //     title: "애니1",
  //     image: anime1,
  //     episode: "2",
  //     ReleaseYear: 2025,
  //   },
  //   { id: 2, title: "애니2", image: anime2, episode: "2", ReleaseYear: 2025 },
  //   { id: 3, title: "애니3", image: anime3, episode: "2", ReleaseYear: 2025 },
  //   { id: 4, title: "애니4", image: anime4, episode: "2", ReleaseYear: 2025 },
  //   { id: 5, title: "애니5", image: anime5, episode: "2", ReleaseYear: 2025 },
  //   { id: 6, title: "애니6", image: anime6, episode: "2", ReleaseYear: 2025 },
  // ];

  const scrollRef = useRef(null);

  const scrollLeft = () => {
    if (scrollRef.current) {
      // 현재 스크롤 위치
      const current = scrollRef.current.scrollLeft;

      // 왼쪽 끝이면 오른쪽 끝으로
      if (current <= 0) {
        scrollRef.current.scrollTo({
          left: scrollRef.current.scrollWidth - scrollRef.current.clientWidth,
          behavior: "smooth",
        });
      } else {
        scrollRef.current.scrollBy({ left: -200, behavior: "smooth" });
      }
    }
  };

  const scrollRight = () => {
    if (scrollRef.current) {
      const current = scrollRef.current.scrollLeft;
      const maxScrollLeft = scrollRef.current.scrollWidth - scrollRef.current.clientWidth;

      // 오른쪽 끝이면 처음으로
      if (current >= maxScrollLeft) {
        scrollRef.current.scrollTo({ left: 0, behavior: "smooth" });
      } else {
        scrollRef.current.scrollBy({ left: 200, behavior: "smooth" });
      }
    }
  };

  useEffect(() => {
    let timeoutId;

    const autoScroll = () => {
      if (scrollRef.current) {
        const maxScrollLeft = scrollRef.current.scrollWidth - scrollRef.current.clientWidth;

        if (scrollRef.current.scrollLeft >= maxScrollLeft) {
          scrollRef.current.scrollTo({ left: 0, behavior: "smooth" });
        } else {
          scrollRef.current.scrollBy({ left: 200, behavior: "smooth" });
        }
      }

      // 다음 실행 시간: 10~15초 랜덤
      const nextDelay = Math.random() * 5000 + 10000;

      timeoutId = setTimeout(autoScroll, nextDelay);
    };

    // 첫 실행도 랜덤하게 시작 가능
    const initialDelay = Math.random() * 5000 + 10000;
    timeoutId = setTimeout(autoScroll, initialDelay);

    return () => clearTimeout(timeoutId);
  }, []);

  return (
    <div className="w-11/12 mx-auto px-4 py-8 relative">
      <h2 className="text-2xl font-bold mb-4  border-gray-300">{title}</h2>

      {/* 좌우 버튼 */}
      <button
        onClick={scrollLeft}
        className="absolute left-0 top-1/2 -translate-y-1/2 bg-black bg-opacity-50 text-white p-2 rounded-full z-10 hover:bg-black/70 transition"
      >
        ◀
      </button>
      <button
        onClick={scrollRight}
        className="absolute right-0 top-1/2 -translate-y-1/2 bg-black bg-opacity-50 text-white p-2 rounded-full z-10 hover:bg-black/70 transition"
      >
        ▶
      </button>

      {/* 가로 스크롤 영역 */}
      <div ref={scrollRef} className="flex space-x-4 w-full overflow-hidden snap-x snap-mandatory  scroll-smooth">
        {animeList.length === 0
          ? Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="w-52 h-72 rounded-2xl bg-gray-200 animate-pulse flex-shrink-0"></div>
            ))
          : animeList.map((anime) => (
              <div
                key={anime.id}
                className="w-52 flex-shrink-0 rounded-2xl overflow-hidden shadow-lg relative  snap-start"
              >
                <img src={anime.image} alt={anime.title} className="w-full h-72 object-cover" />
                {/* 그라데이션 + 제목 */}
                <div className="absolute bottom-0 w-full bg-gradient-to-t from-black/60 to-transparent p-2">
                  <h3 className="text-white font-semibold text-base line-clamp-2">{anime.title}</h3>
                </div>
                {/* 배지: 평점 / 에피소드 */}
                <div className="absolute top-2 left-2">
                  {anime.episode && (
                    <span className="bg-gray-200 text-xs px-2 py-0.5 rounded-full font-semibold text-gray-800">
                      {anime.episode}화
                    </span>
                  )}
                </div>
              </div>
            ))}
      </div>
    </div>
  );
}

export default MainPageCard;
