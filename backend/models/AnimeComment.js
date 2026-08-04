import mongoose from "mongoose";

const animeCommentSchema = new mongoose.Schema(
  {
    animeId: { type: Number, required: true, index: true },
    userId: { type: String, required: true, index: true },
    author: { type: String, required: true, trim: true },
    content: { type: String, required: true, trim: true, maxlength: 1000 },
    recommendCount: { type: Number, default: 0, min: 0, index: true },
  },
  { timestamps: true },
);

animeCommentSchema.index({ animeId: 1, recommendCount: -1, createdAt: -1 });
animeCommentSchema.index({ animeId: 1, createdAt: -1 });

export default mongoose.model("AnimeComment", animeCommentSchema);
