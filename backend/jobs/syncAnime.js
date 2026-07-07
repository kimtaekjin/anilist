import { fetchAnime } from "../components/fetchAnime.js";
import { queries } from "../components/animeQuery.js";

const DEFAULT_INTERVAL = 1000 * 60 * 60 * 6;
const DEFAULT_TYPE_DELAY = 1000 * 60;
const DEFAULT_STARTUP_DELAY = 1000 * 60;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const syncTargets = [
  ["trending", queries.trending],
  ["airing", queries.airing],
  ["completed", queries.completed],
  ["ova", queries.ova],
  ["upcoming", queries.upcoming],
];

export async function syncAll(options = {}) {
  const typeDelay = Number(options.typeDelayMs ?? process.env.ANIME_SYNC_TYPE_DELAY_MS ?? DEFAULT_TYPE_DELAY);

  console.log("애니 데이터 동기화 시작");

  for (const [type, query] of syncTargets) {
    try {
      await fetchAnime(query, type);
      await sleep(typeDelay);
    } catch (err) {
      console.error(`[${type}] 동기화 실패:`, err);
      if (err.status === 429 || err.status === 403 || err.status >= 500) {
        console.error("AniList 호출 제한 또는 일시 장애로 이번 동기화 사이클을 중단합니다.");
        break;
      }
      await sleep(typeDelay);
    }
  }

  console.log("애니 데이터 동기화 종료");
}

export function startAnimeSync(options = {}) {
  const interval = Number(options.intervalMs ?? process.env.ANIME_SYNC_INTERVAL_MS ?? DEFAULT_INTERVAL);
  const startupDelay = Number(options.startupDelayMs ?? process.env.ANIME_SYNC_STARTUP_DELAY_MS ?? DEFAULT_STARTUP_DELAY);

  const timeoutId = setTimeout(syncAll, startupDelay);
  const intervalId = setInterval(syncAll, interval);

  return {
    timeoutId,
    intervalId,
    stop() {
      clearTimeout(timeoutId);
      clearInterval(intervalId);
    },
  };
}
