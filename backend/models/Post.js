import mongoose from "mongoose";

const postSchema = new mongoose.Schema(
  {
    number: { type: Number, required: true },
    title: { type: String, required: true, trim: true },
    content: { type: String, required: true },
    author: { type: String, required: true }, // 작성자
    userId: { type: String, require: true },
    category: { type: String, default: "자유" }, // 말머리
    comments: [
      {
        author: String,
        content: String,
        userId: String,
        createdAt: { type: Date, default: Date.now },
      },
    ], // 댓글
    recommend: { type: Number, default: 0 }, // 추천 수
    isNotice: { type: Boolean, default: false }, // 공지 여부
    views: { type: Number, default: 0 },
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

postSchema.index({ number: -1 });

const Post = mongoose.model("Post", postSchema);

export default Post;
