// components/GenreSection.jsx
const genres = ["액션", "로맨스", "판타지", "SF", "일상", "스포츠"];

function GenreSection() {
  return (
    <section>
      <h2>🎭 장르</h2>
      <div className="genre-list">
        {genres.map((genre) => (
          <button key={genre}>{genre}</button>
        ))}
      </div>
    </section>
  );
}

export default GenreSection;
