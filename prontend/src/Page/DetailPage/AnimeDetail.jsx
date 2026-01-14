import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Building } from "lucide-react";

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
        console.log("데이터확인:", json);
        setAnime(json.data.Media);
      } catch (err) {
        console.error("AniList fetch error:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchAnime();
  }, [id]);

  if (loading) return <p className="text-center py-20">Loading...</p>;
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
        <img src={anime.coverImage.extraLarge} alt={anime.title.romaji} className="w-56 rounded-xl shadow-lg" />

        <div className="flex-1">
          <h1 className="text-3xl font-bold mb-2">{anime.title.english || anime.title.romaji}</h1>
          <p className="text-gray-500 mb-4">
            {anime.season} {anime.seasonYear} ·{" "}
            {anime.status === "RELEASING" ? (
              <span className="text-red-500 font-semibold">{currentEpisode}화 방영 중</span>
            ) : (
              `총 ${anime.episodes || "?"}화`
            )}
            {/* {" · "} <Building size={14} className="text-gray-400" /> {anime.studios.edges[0]?.node.name || "미정"}
            {" · "}Score: {anime.averageScore || "-"} */}
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
          {anime.characters.edges.map(({ node }) => (
            <div key={node.name.full} className="text-center">
              <img src={node.image.large} alt={node.name.full} className="w-full h-40 object-cover rounded-lg mb-1" />
              <p className="text-sm">{node.name.full}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AnimeDetail;
