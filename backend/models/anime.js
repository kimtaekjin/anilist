import mongoose from "mongoose";

const anime = new mongoose.Schema({
  _id: Number, // AniList ID (Primary Key 역할)
  idMal: Number, // MyAnimeList ID
  type: {
    type: String,
    enum: ["TV", "TV_SHORT", "MOVIE", "OVA", "ONA", "SPECIAL", "MUSIC"],
  },
  title: {
    romaji: String,
    english: String,
    native: String,
  },
  description: String,
  image: {
    large: { type: String, default: "" },
    extraLarge: { type: String, default: "" },
    banner: { type: String, default: "" },
  },
  bannerImage: String,
  genres: [String],
  days: String,
  startDate: {
    year: Number,
    month: Number,
    day: Number,
  },
  season: String, // Winter, Spring 등
  seasonYear: Number,
  episodes: Number,
  status: String, // FINISHED, RELEASING 등
  averageScore: Number,
  popularity: Number,
  studio: [String],
  trailer: {
    id: String,
    site: String,
  },
  nextAiringEpisode: {
    episode: Number,
    airingAt: Number,
  },
  characters: [
    {
      role: String,
      name: {
        full: String,
        native: String,
      },
      image: {
        large: String,
      },
    },
  ],
  contentTypes: {
    type: [String], // 배열
    enum: ["trending", "completed", "upcoming", "ova", "genre"], // enum 제한
    default: [],
  }, //요청형식
  updatedAt: Number, // AniList에서 마지막 갱신 timestamp
  lastSyncedAt: Date, // 우리 서버에서 마지막 동기화 시간
  createdAt: Date,
  modifiedAt: Date,
});

const Anime = mongoose.model("Anime", anime);

export default Anime;
