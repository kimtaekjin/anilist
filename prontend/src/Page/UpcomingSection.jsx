// components/UpcomingSection.jsx
function UpcomingSection(/*{ list }*/) {
  return (
    <section>
      <h2>⏳ 방영 예정</h2>
      {/* <div className="card-grid">
        {list.map((anime) => (
          <div key={anime.id} className="anime-card">
            <h3>{anime.title}</h3>
            <p>방영 시작: {anime.startDate}</p>
            <p>제작사: {anime.studio}</p>
          </div>
        ))}
      </div> */}
    </section>
  );
}

export default UpcomingSection;
