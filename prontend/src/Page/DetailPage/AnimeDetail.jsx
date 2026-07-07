import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Building } from "lucide-react";
import { fetchDetailAnime } from "../../Components/items/AniListItem.jsx";
import { AnimeDetailSkeleton } from "../../Components/items/Skeleton";
import StarRating from "../../Components/items/StarRating";

const AnimeDetail = () => {
  const { id } = useParams();
  const [anime, setAnime] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAnime = async () => {
      try {
        const translatedData = await fetchDetailAnime("detail", id);
        setAnime(translatedData);
      } catch (err) {
        console.error("AniList fetch error:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchAnime();
  }, [id]);

  if (loading) return <AnimeDetailSkeleton />;

  if (!anime) {
    return <p className="py-20 text-center text-stone-300">데이터를 불러올 수 없습니다.</p>;
  }

  const currentEpisode =
    anime.status === "RELEASING" && anime.nextAiringEpisode ? anime.nextAiringEpisode.episode : anime.episodes;

  return (
    <div className="container mx-auto px-4 py-10">
      {anime?.image?.banner && (
        <img
          src={anime.image.banner}
          alt={anime?.title || anime?.originalTitle?.native || anime?.originalTitle?.romaji || ""}
          className="mb-6 h-72 w-full rounded-2xl object-cover"
        />
      )}

      <div className="mb-6 flex flex-col gap-6 md:flex-row">
        <img src={anime?.image?.large} alt={anime?.title || ""} className="w-56 rounded-xl shadow-lg" />

        <div className="flex-1">
          <h1 className="mb-2 text-2xl font-bold text-stone-50">{anime?.title || ""}</h1>

          <p className="mb-4 text-stone-400">
            {anime?.season} {anime?.seasonYear} <span className="mx-2 text-stone-600">/</span>
            {anime?.status === "RELEASING" ? (
              <span className="font-semibold text-red-300">{currentEpisode}화 방영중</span>
            ) : (
              <span>
                {anime?.episodes
                  ? `${anime.episodes}화 완결`
                  : anime?.startDate
                    ? `${anime.startDate} 방영 예정`
                    : "방영일 미정"}
              </span>
            )}
          </p>

          <div className="flex items-center gap-1 text-stone-300">
            <Building size={14} className="text-stone-500" />
            {Array.isArray(anime?.studio) ? anime.studio.join(", ") : anime?.studio || "미정"}
          </div>

          <div className="mx-4 my-2 flex items-center gap-2">
            <StarRating score={anime?.averageScore} size={18} showText />
          </div>

          <div className="mb-4 flex flex-wrap gap-2">
            {anime?.genres?.map((genre) => (
              <span key={genre} className="rounded-full bg-red-500/15 px-3 py-1 text-sm text-red-200">
                {genre}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="mb-8">
        <h2 className="mb-2 text-2xl font-bold text-stone-50">줄거리</h2>
        <p className="leading-relaxed text-stone-100" dangerouslySetInnerHTML={{ __html: anime?.description }} />
      </div>

      {anime?.trailer?.site === "youtube" && (
        <div className="mb-8">
          <h2 className="mb-2 text-2xl font-bold text-stone-50">트레일러</h2>
          <iframe
            className="h-96 w-full rounded-2xl"
            src={`https://www.youtube.com/embed/${anime.trailer.id}`}
            title="Trailer"
            allowFullScreen
          />
        </div>
      )}

      <div>
        <h2 className="mb-4 text-2xl font-bold text-stone-50">캐릭터</h2>

        <div className="grid grid-cols-3 gap-4 sm:grid-cols-4 md:grid-cols-6">
          {anime?.characters?.map((character) => (
            <div key={character?.name?.full} className="text-center">
              <img
                src={character?.image?.large}
                alt={character?.name?.full}
                className="mb-1 h-40 w-full rounded-lg object-cover"
              />
              <p className="text-sm text-stone-200">{character?.name?.native || character?.name?.full}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AnimeDetail;
