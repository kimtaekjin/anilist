import { fetchAnime } from "../components/fetchAnime.js";
import { queries } from "../components/animeQuery.js";

const INTERVAL = 1000 * 60 * 30; // 30분

async function syncAll() {
  console.log("애니 데이터 동기화 시작");

  try {
    await fetchAnime(queries.trending, "trending");
    await fetchAnime(queries.airing, "airing");
    await fetchAnime(queries.completed, "completed");

    console.log("동기화 완료");
  } catch (err) {
    console.error("동기화 실패:", err);
  }
}

// 서버 시작 시 1번 실행
syncAll();

// 이후 반복
setInterval(syncAll, INTERVAL);
