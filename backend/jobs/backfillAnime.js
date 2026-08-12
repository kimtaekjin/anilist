import "dotenv/config";
import mongoose from "mongoose";
import redis from "../config/redis.js";
import { fetchAnime } from "../components/fetchAnime.js";
import { queries } from "../components/animeQuery.js";
import { warmGenreCache } from "./syncAnime.js";

const SEASONS = ["WINTER", "SPRING", "SUMMER", "FALL"];

function getArgument(name) {
  const prefix = `--${name}=`;
  const argument = process.argv.find((value) => value.startsWith(prefix));
  return argument ? argument.slice(prefix.length) : undefined;
}

function getYear(name, fallback) {
  const value = Number(getArgument(name) ?? process.env[`ANIME_BACKFILL_${name.toUpperCase()}_YEAR`] ?? fallback);
  if (!Number.isInteger(value)) {
    throw new Error(`${name} year must be an integer.`);
  }
  return value;
}

async function run() {
  const currentYear = new Date(Date.now() + 9 * 60 * 60 * 1000).getUTCFullYear();
  const startYear = getYear(
    "start",
    Number(process.env.ANIME_CATALOG_START_YEAR || 2000),
  );
  const endYear = getYear("end", currentYear);

  if (startYear > endYear) {
    throw new Error("start year cannot be greater than end year.");
  }

  const targets = [];
  for (let year = startYear; year <= endYear; year += 1) {
    for (const season of SEASONS) targets.push({ year, season });
  }

  const failures = [];

  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log(`Anime backfill started: ${startYear}-${endYear}, ${targets.length} seasons.`);

    for (let index = 0; index < targets.length; index += 1) {
      const target = targets[index];
      const label = `${target.year} ${target.season}`;
      const startedAt = Date.now();

      console.log(`[${index + 1}/${targets.length}] ${label} collecting all pages.`);

      try {
        const result = await fetchAnime(queries.genre, "genre", target, { fetchAllPages: true });
        await warmGenreCache(target);
        console.log(
          `[${label}] ${result.fetchedCount} anime across ${result.pageCount} pages; ` +
            `completed in ${Math.round((Date.now() - startedAt) / 1000)}s.`,
        );
      } catch (error) {
        failures.push({ label, message: error.message });
        console.error(`[${label}] backfill failed:`, error.message);
      }
    }

    if (failures.length) {
      console.error(`Anime backfill finished with ${failures.length} failed seasons.`);
      process.exitCode = 1;
    } else {
      console.log("Anime backfill completed successfully.");
    }
  } finally {
    if (redis.isOpen) await redis.quit().catch(() => {});
    await mongoose.disconnect().catch(() => {});
  }
}

run().catch(async (error) => {
  console.error("Anime backfill failed:", error);
  process.exitCode = 1;
  if (redis.isOpen) await redis.quit().catch(() => {});
  await mongoose.disconnect().catch(() => {});
});
