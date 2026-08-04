import mongoose from "mongoose";

const animeCommentVoteSchema = new mongoose.Schema(
  {
    commentId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    userId: { type: String, required: true, index: true },
  },
  { timestamps: true },
);

animeCommentVoteSchema.index({ commentId: 1, userId: 1 }, { unique: true });

export default mongoose.model("AnimeCommentVote", animeCommentVoteSchema);
