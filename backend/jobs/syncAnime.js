import { fetchAnime } from "../components/fetchAnime.js";
import { queries } from "../components/animeQuery.js";

const INTERVAL = 1000 * 60 * 60 * 6;
const TYPE_DELAY = 1000 * 60;
const STARTUP_SYNC_DELAY = 1000 * 60;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const syncTargets = [
  ["trending", queries.trending],
  ["airing", queries.airing],
  ["completed", queries.completed],
  ["ova", queries.ova],
  ["upcoming", queries.upcoming],
];

async function syncAll() {
  console.log("애니 데이터 동기화 시작");

  for (const [type, query] of syncTargets) {
    try {
      await fetchAnime(query, type);
      await sleep(TYPE_DELAY);
    } catch (err) {
      console.error(`[${type}] 동기화 실패:`, err);
      if (err.status === 429 || err.status >= 500) {
        console.error("Jikan 호출 제한 또는 임시 장애로 이번 동기화 사이클을 중단합니다.");
        break;
      }
      await sleep(TYPE_DELAY);
    }
  }

  console.log("애니 데이터 동기화 종료");
}

export function startAnimeSync() {
  setTimeout(syncAll, STARTUP_SYNC_DELAY);
  return setInterval(syncAll, INTERVAL);
}
