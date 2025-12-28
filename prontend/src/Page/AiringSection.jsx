// components/AiringSection.jsx
function AiringSection(/*{ list }*/) {
  return (
    <section>
      <h2>📺 현재 방영 중</h2>
      {/* <div className="card-grid">
        {list.map((anime) => (
          <div key={anime.id} className="anime-card">
            <img src={anime.image} alt={anime.title} />
            <h3>{anime.title}</h3>
            <p>{anime.day}</p>
            <span>⭐ {anime.rating}</span>
          </div>
        ))}
      </div> */}
    </section>
  );
}

export default AiringSection;
