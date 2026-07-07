import mongoose from "mongoose";

const commentSchema = new mongoose.Schema(
  {
    author: { type: String, required: true, trim: true },
    content: { type: String, required: true, trim: true, maxlength: 1000 },
    userId: { type: String, required: true, index: true },
  },
  {
    timestamps: true,
  },
);

const postSchema = new mongoose.Schema(
  {
    number: { type: Number, required: true, unique: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 30 },
    content: { type: String, required: true, trim: true, maxlength: 10000 },
    author: { type: String, required: true, trim: true },
    userId: { type: String, required: true, index: true },
    category: { type: String, default: "자유", trim: true },
    comments: [commentSchema],
    recommend: { type: Number, default: 0, min: 0 },
    isNotice: { type: Boolean, default: false },
    views: { type: Number, default: 0, min: 0 },
    viewLogs: [
      {
        userId: String,
        ip: String,
        userAgent: String,
        timestamp: { type: Date, default: Date.now },
      },
    ],
  },
  {
    timestamps: true,
  },
);

postSchema.index({ isNotice: -1, number: -1 });
postSchema.index({ createdAt: -1 });

const Post = mongoose.model("Post", postSchema);

export default Post;
