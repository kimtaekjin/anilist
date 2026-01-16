import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Building } from "lucide-react";
import { translateText } from "../../Components/items/translate";

import StarRating from "../../Components/items/StarRating ";
const AnimeDetail = () => {
  const { id } = useParams();
  const [anime, setAnime] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAnime = async () => {
      const query = `
        query ($id: Int) {
          Media(idMal: $id, type: ANIME) {
            id
            idMal
            title {
              romaji
              english
              native
            }
            description
            coverImage {
              extraLarge
              large
            }
            bannerImage
            genres
            season
            seasonYear
            episodes
            status
            averageScore
            popularity
            studios {
              edges {
                node {
                  name
                }
              }
            }
            nextAiringEpisode {
              episode
              airingAt
            }
            trailer {
              id
              site
            }
            characters(sort: ROLE, perPage: 6) {
              edges {
                role
                node {
                  name {
                    full
                  }
                  image {
                    large
                  }
                }
              }
            }
          }
        }
      `;

      try {
        const res = await fetch("https://graphql.anilist.co", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query,
            variables: { id: Number(id) },
          }),
        });

        const json = await res.json();
        const data = json.data.Media;

        const translatedData = {
          ...data,
          title: data.title.native
            ? await translateText(data.title.native)
            : data.title.romaji || data.title.english || "제목 없음",
          description: data.description ? await translateText(data.description) : "줄거리 정보 없음",
          genres: data.genres ? await Promise.all(data.genres.map((g) => translateText(g))) : [],
          characters: data.characters?.edges
            ? await Promise.all(
                data.characters.edges.map(async (edge) => ({
                  role: edge.role,
                  name: edge.node.name.full ? await translateText(edge.node.name.full) : "이름 없음",
                  image: edge.node.image?.large ?? "/default-character.jpg",
                }))
              )
            : [],
        };

        // console.log("데이터확인:", data);
        console.log("제목확인:", translatedData);
        setAnime(translatedData);
      } catch (err) {
        console.error("AniList fetch error:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchAnime();
  }, [id]);

  const AnimeDetailSkeleton = () => {
    return (
      <div className="container mx-auto px-4 py-10 animate-pulse">
        {/* 배너 */}
        <div className="w-full h-72 bg-gray-200 rounded-2xl mb-6" />

        {/* 상단 정보 */}
        <div className="flex flex-col md:flex-row gap-6 mb-6">
          {/* 커버 이미지 */}
          <div className="w-56 h-80 bg-gray-200 rounded-xl shadow-lg" />

          {/* 텍스트 영역 */}
          <div className="flex-1 space-y-4">
            {/* 제목 */}
            <div className="h-8 bg-gray-200 rounded w-3/4" />

            {/* 시즌 / 상태 */}
            <div className="h-4 bg-gray-200 rounded w-1/2" />

            {/* 평점 */}
            <div className="h-5 bg-gray-200 rounded w-32" />

            {/* 장르 */}
            <div className="flex flex-wrap gap-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="px-4 py-2 bg-gray-200 rounded-full w-20 h-6" />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  };

  if (loading) return <AnimeDetailSkeleton />;
  if (!anime) return <p className="text-center py-20">데이터를 불러올 수 없습니다.</p>;

  // 🔥 현재 방영 화수 계산
  const currentEpisode =
    anime.status === "RELEASING" && anime.nextAiringEpisode ? anime.nextAiringEpisode.episode - 1 : anime.episodes;

  return (
    <div className="container mx-auto px-4 py-10">
      {/* 배너 */}
      {anime.bannerImage && (
        <img src={anime.bannerImage} alt={anime.title.romaji} className="w-full h-72 object-cover rounded-2xl mb-6" />
      )}

      {/* 상단 정보 */}
      <div className="flex flex-col md:flex-row gap-6 mb-6 ">
        <img src={anime.coverImage.extraLarge} alt={anime.title} className="w-56 rounded-xl shadow-lg" />

        <div className="flex-1">
          <h1 className="text-2xl font-bold mb-2">{anime.title || anime.title.romaji}</h1>
          <p className="text-gray-500 mb-4">
            {anime.season} {anime.seasonYear} ·{" "}
            {anime.status === "RELEASING" ? (
              <span className="text-red-500 font-semibold">{currentEpisode}화 방영 중</span>
            ) : (
              `총 ${anime.episodes || "?"}화`
            )}
          </p>
          <div className="flex items-center gap-1">
            <Building size={14} className="text-gray-400" /> {anime.studios.edges[0]?.node.name || "미정"}
          </div>
          <div className="flex items-center gap-2 mx-4 my-2">
            <StarRating score={anime.averageScore} size={18} showText={true} />
          </div>

          {/* 장르 */}
          <div className="flex flex-wrap gap-2 mb-4">
            {anime.genres.map((genre) => (
              <span key={genre} className="px-3 py-1 bg-red-100 text-red-600 rounded-full text-sm">
                {genre}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* 줄거리 */}
      <div className="mb-8">
        <h2 className="text-2xl font-bold mb-2">줄거리</h2>
        <p className="leading-relaxed text-gray-700" dangerouslySetInnerHTML={{ __html: anime.description }} />
      </div>

      {/* 트레일러 */}
      {anime.trailer && anime.trailer.site === "youtube" && (
        <div className="mb-8">
          <h2 className="text-2xl font-bold mb-2">트레일러</h2>
          <iframe
            className="w-full h-96 rounded-2xl"
            src={`https://www.youtube.com/embed/${anime.trailer.id}`}
            title="Trailer"
            allowFullScreen
          />
        </div>
      )}

      {/* 캐릭터 */}
      <div>
        <h2 className="text-2xl font-bold mb-4">캐릭터</h2>
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-4">
          {anime.characters.map((anime) => (
            <div key={anime.name} className="text-center">
              <img src={anime.image} alt={anime.name} className="w-full h-40 object-cover rounded-lg mb-1" />
              <p className="text-sm">{anime.name}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AnimeDetail;
