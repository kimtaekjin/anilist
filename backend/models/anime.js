import mongoose from "mongoose";

const CONTENT_TYPES = ["trending", "completed", "upcoming", "ova", "genre", "airing", "detail"];
const MEDIA_TYPES = ["TV", "TV_SHORT", "MOVIE", "OVA", "ONA", "SPECIAL", "MUSIC"];

const titleSchema = new mongoose.Schema(
  {
    romaji: { type: String, default: "" },
    english: { type: String, default: "" },
    native: { type: String, default: "" },
  },
  { _id: false },
);

const imageSchema = new mongoose.Schema(
  {
    large: { type: String, default: "" },
    extraLarge: { type: String, default: "" },
    banner: { type: String, default: "" },
  },
  { _id: false },
);

const dateSchema = new mongoose.Schema(
  {
    year: { type: Number, default: null },
    month: { type: Number, default: null },
    day: { type: Number, default: null },
  },
  { _id: false },
);

const animeSchema = new mongoose.Schema(
  {
    _id: { type: Number, required: true },
    idMal: { type: Number, default: null, index: true },
    type: {
      type: String,
      enum: MEDIA_TYPES,
    },
    title: { type: String, default: "", trim: true },
    originalTitle: { type: titleSchema, default: () => ({}) },
    description: { type: String, default: "" },
    image: { type: imageSchema, default: () => ({}) },
    bannerImage: { type: String, default: "" },
    genres: { type: [String], default: [] },
    days: { type: String, default: "" },
    startDate: { type: dateSchema, default: () => ({}) },
    season: { type: String, default: "", index: true },
    seasonYear: { type: Number, default: null, index: true },
    episodes: { type: Number, default: 0 },
    status: { type: String, default: "", index: true },
    averageScore: { type: Number, default: 0, index: true },
    popularity: { type: Number, default: 0, index: true },
    studio: { type: [String], default: ["미정"] },
    trailer: {
      id: { type: String, default: "" },
      site: { type: String, default: "" },
    },
    nextAiringEpisode: {
      episode: { type: Number, default: null },
      airingAt: { type: Number, default: null },
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
      type: [
        {
          type: String,
          enum: CONTENT_TYPES,
        },
      ],
      default: [],
      index: true,
    },
    updatedAt: { type: Number, default: null },
    lastSyncedAt: { type: Date, default: null, index: true },
  },
  {
    timestamps: { createdAt: "createdAt", updatedAt: "modifiedAt" },
  },
);

animeSchema.index({ contentTypes: 1, popularity: -1, averageScore: -1 });
animeSchema.index({ contentTypes: 1, averageScore: -1, popularity: -1 });
animeSchema.index({ contentTypes: 1, season: 1, seasonYear: 1, popularity: -1 });

const Anime = mongoose.model("Anime", animeSchema);

export default Anime;
