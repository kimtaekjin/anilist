import React, { useEffect, useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";

function MainPageCard({ title, animeList }) {
  const scrollRef = useRef(null);
  const navigate = useNavigate();

  const scrollLeft = () => {
    if (!scrollRef.current) return;

    const current = scrollRef.current.scrollLeft;
    if (current <= 0) {
      scrollRef.current.scrollTo({
        left: scrollRef.current.scrollWidth - scrollRef.current.clientWidth,
        behavior: "smooth",
      });
      return;
    }

    scrollRef.current.scrollBy({ left: -220, behavior: "smooth" });
  };

  const scrollRight = () => {
    if (!scrollRef.current) return;

    const current = scrollRef.current.scrollLeft;
    const maxScroll = scrollRef.current.scrollWidth - scrollRef.current.clientWidth;

    if (current >= maxScroll) {
      scrollRef.current.scrollTo({ left: 0, behavior: "smooth" });
      return;
    }

    scrollRef.current.scrollBy({ left: 220, behavior: "smooth" });
  };

  useEffect(() => {
    let timeoutId;

    const autoScroll = () => {
      if (scrollRef.current) {
        const maxScroll = scrollRef.current.scrollWidth - scrollRef.current.clientWidth;

        if (scrollRef.current.scrollLeft >= maxScroll) {
          scrollRef.current.scrollTo({ left: 0, behavior: "smooth" });
        } else {
          scrollRef.current.scrollBy({ left: 220, behavior: "smooth" });
        }
      }

      timeoutId = setTimeout(autoScroll, Math.random() * 5000 + 10000);
    };

    timeoutId = setTimeout(autoScroll, Math.random() * 5000 + 10000);

    return () => clearTimeout(timeoutId);
  }, []);

  return (
    <section className="relative mx-auto w-11/12 px-4 py-8">
      <h2 className="mb-4 text-2xl font-bold text-stone-50">{title}</h2>

      <button
        type="button"
        aria-label={`${title} 왼쪽으로 이동`}
        onClick={scrollLeft}
        className="absolute left-0 top-1/2 z-10 inline-flex h-9 w-9 -translate-y-1/5 items-center justify-center rounded-full border border-stone-100/10 bg-black/55 text-white transition hover:bg-black/75 focus:outline-none focus:ring-4 focus:ring-amber-500/20"
      >
        <ChevronLeft size={20} />
      </button>
      <button
        type="button"
        aria-label={`${title} 오른쪽으로 이동`}
        onClick={scrollRight}
        className="absolute right-0 top-1/2 z-10 inline-flex h-9 w-9 -translate-y-1/5 items-center justify-center rounded-full border border-stone-100/10 bg-black/55 text-white transition hover:bg-black/75 focus:outline-none focus:ring-4 focus:ring-amber-500/20"
      >
        <ChevronRight size={20} />
      </button>

      <div ref={scrollRef} className="flex w-full snap-x snap-mandatory space-x-4 overflow-hidden scroll-smooth">
        {(animeList ?? []).length === 0
          ? Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="h-72 w-52 flex-shrink-0 animate-pulse rounded-lg border border-stone-100/10 bg-[#181816]"
              />
            ))
          : (animeList ?? []).map((anime, index) => (
              <button
                key={anime._id}
                type="button"
                className="relative w-52 flex-shrink-0 cursor-pointer snap-start overflow-hidden rounded-lg border border-stone-100/10 bg-[#181816] text-left shadow-lg shadow-black/20 transition duration-300 hover:-translate-y-1 hover:border-amber-500/60 focus:outline-none focus:ring-4 focus:ring-amber-500/20"
                onClick={() => navigate(`/AnimeDetail/${anime._id}`)}
              >
                <img
                  src={anime.image?.large}
                  alt={anime.title}
                  className="h-72 w-full object-cover"
                  loading={index < 6 ? "eager" : "lazy"}
                  decoding="async"
                />

                <div className="absolute bottom-0 w-full bg-gradient-to-t from-black/75 to-transparent p-3">
                  <h3 className="line-clamp-2 text-base font-semibold text-white">{anime.title}</h3>
                </div>

                {anime.episodes ? (
                  <div className="absolute left-2 top-2">
                    <span className="rounded-full bg-stone-950/75 px-2 py-0.5 text-xs font-semibold text-stone-100 backdrop-blur">
                      {anime.episodes}화
                    </span>
                  </div>
                ) : null}
              </button>
            ))}
      </div>
    </section>
  );
}

export default MainPageCard;
