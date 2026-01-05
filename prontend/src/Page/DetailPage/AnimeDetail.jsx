import React, { useEffect, useState } from "react";

export const AnimeDetail = ({ id }) => {
  const [anime, setAnime] = useState(null);

  useEffect(() => {
    const fetchAnime = async () => {
      const query = `
        query ($id: Int) {
          Media(id: $id, type: ANIME) {
            id
            title { romaji english native }
            description
            coverImage { extraLarge large }
            bannerImage
            genres
            season
            seasonYear
            episodes
            averageScore
            popularity
            studios { edges { node { name } } }
            characters(sort: ROLE, perPage: 6) {
              edges { role node { name { full } image { large } } }
            }
            trailer { id site }
          }
        }
      `;
      const variables = { id };

      try {
        const res = await fetch("https://graphql.anilist.co", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query, variables }),
        });
        const data = await res.json();
        setAnime(data.data.Media);
      } catch (err) {
        console.error(err);
      }
    };

    fetchAnime();
  }, [id]);

  if (!anime) return <p>Loading AniList data...</p>;

  return (
    <div className="container mx-auto p-6">
      {/* 배너 */}
      {anime.bannerImage && (
        <img src={anime.bannerImage} alt={anime.title.romaji} className="w-full h-64 object-cover rounded-2xl mb-4" />
      )}

      {/* 제목 */}
      <h1 className="text-4xl font-bold mb-2">{anime.title.english || anime.title.romaji}</h1>
      <p className="text-gray-500 mb-4">
        {anime.season} {anime.seasonYear} | Episodes: {anime.episodes || "미정"} | Studio:{" "}
        {anime.studios.edges[0]?.node.name || "미정"} | Score: {anime.averageScore || "-"}
      </p>

      {/* 장르 */}
      <div className="flex flex-wrap gap-2 mb-4">
        {anime.genres.map((g) => (
          <span key={g} className="px-2 py-1 bg-red-200 rounded">
            {g}
          </span>
        ))}
      </div>

      {/* 줄거리 */}
      <p className="mb-6" dangerouslySetInnerHTML={{ __html: anime.description }} />

      {/* 트레일러 */}
      {anime.trailer && anime.trailer.site === "youtube" && (
        <iframe
          className="w-full h-64 mb-6 rounded-2xl"
          src={`https://www.youtube.com/embed/${anime.trailer.id}`}
          title="Trailer"
          allowFullScreen
        />
      )}

      {/* 캐릭터 */}
      <h2 className="text-2xl font-bold mb-2">Characters</h2>
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-4">
        {anime.characters.edges.map(({ node }) => (
          <div key={node.name.full} className="text-center">
            <img src={node.image.large} alt={node.name.full} className="w-full h-40 object-cover rounded-lg mb-1" />
            <p className="text-sm">{node.name.full}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AnimeDetail;
