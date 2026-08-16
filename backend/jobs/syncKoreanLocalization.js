import "dotenv/config";
import mongoose from "mongoose";
import redis from "../config/redis.js";
import Anime from "../models/anime.js";

const ENDPOINT = "https://query.wikidata.org/sparql";
const BATCH_SIZE = 100;
const APPLY = process.argv.includes("--apply");
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function normalizeDisplayTitle(title) {
  return title.replace(/\s+\(애니메이션\)$/u, "").trim();
}

async function fetchWikidataBatch(ids) {
  const values = ids.map((id) => `"${id}"`).join(" ");
  const query = `
    SELECT ?anilistId ?item ?koLabel ?koArticle WHERE {
      VALUES ?anilistId { ${values} }
      ?item wdt:P8729 ?anilistId.
      OPTIONAL { ?item rdfs:label ?koLabel FILTER(LANG(?koLabel) = "ko") }
      OPTIONAL { ?koArticle schema:about ?item; schema:isPartOf <https://ko.wikipedia.org/>. }
    }
  `;
  const response = await fetch(`${ENDPOINT}?format=json&query=${encodeURIComponent(query)}`, {
    headers: {
      Accept: "application/sparql-results+json",
      "User-Agent": "AniwikiLocalizationAudit/1.0",
    },
    signal: AbortSignal.timeout(30000),
  });
  if (!response.ok) throw new Error(`Wikidata request failed (${response.status})`);
  return (await response.json()).results.bindings;
}

async function run() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    const anime = await Anime.find({ seasonYear: { $gte: 2000 } })
      .select("_id title localization")
      .sort({ _id: 1 })
      .lean();
    const candidates = new Map();

    for (let offset = 0; offset < anime.length; offset += BATCH_SIZE) {
      const batch = anime.slice(offset, offset + BATCH_SIZE);
      const rows = await fetchWikidataBatch(batch.map((item) => String(item._id)));
      for (const row of rows) {
        const id = Number(row.anilistId?.value);
        const label = row.koLabel?.value?.trim();
        if (!Number.isInteger(id) || !label) continue;
        candidates.set(id, {
          title: normalizeDisplayTitle(label),
          itemUrl: row.item?.value || "",
          articleUrl: row.koArticle?.value || "",
        });
      }
      console.log(`[${Math.min(offset + BATCH_SIZE, anime.length)}/${anime.length}] 한국어 제목 ${candidates.size}건 발견`);
      await sleep(250);
    }

    const changes = anime
      .map((item) => ({ item, candidate: candidates.get(Number(item._id)) }))
      .filter(({ item, candidate }) => candidate && item.title !== candidate.title);
    const approvedChanges = changes.filter(({ item, candidate }) => {
      const currentHasKorean = /[가-힣]/.test(item.title || "");
      return Boolean(candidate.articleUrl) || !currentHasKorean;
    });

    console.log(
      `Wikidata ID 일치 후보 ${candidates.size}건, 전체 차이 ${changes.length}건, ` +
        `고신뢰 반영 대상 ${approvedChanges.length}건, mode=${APPLY ? "apply" : "dry-run"}`,
    );
    console.log(approvedChanges.slice(0, 30).map(({ item, candidate }) => `[${item._id}] ${item.title} -> ${candidate.title}`).join("\n"));

    if (APPLY && approvedChanges.length) {
      await Anime.bulkWrite(
        approvedChanges.map(({ item, candidate }) => ({
          updateOne: {
            filter: { _id: item._id },
            update: {
              $set: {
                title: candidate.title,
                "localization.title": candidate.title,
                "localization.titleSource": "wikidata-ko",
                "localization.titleSourceUrl": candidate.itemUrl,
                "localization.titleConfidence": candidate.articleUrl ? 1 : 0.9,
                "localization.titleReviewedAt": new Date(),
                "localization.koreanArticleUrl": candidate.articleUrl,
              },
            },
          },
        })),
        { ordered: false },
      );

      if (redis.isReady) {
        const keys = [];
        for await (const key of redis.scanIterator({ MATCH: "anime:*", COUNT: 200 })) {
          if (Array.isArray(key)) keys.push(...key);
          else keys.push(key);
        }
        if (keys.length) await redis.del(keys);
      }
      console.log(`한국어 제목 ${approvedChanges.length}건 반영 완료`);
    }
  } finally {
    if (redis.isOpen) await redis.quit().catch(() => {});
    await mongoose.disconnect().catch(() => {});
  }
}

run().catch((error) => {
  console.error("한국어 현지화 동기화 실패:", error);
  process.exitCode = 1;
});
