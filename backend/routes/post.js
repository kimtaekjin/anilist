import express from "express";
const router = express.Router();

import jwt from "jsonwebtoken";
import Post from "../models/Post.js";

router.use(express.json());

const verifyToken = (req, res, next) => {
  const token = req.cookies.token;
  if (!token) return res.status(401).json({ message: "인증이 필요합니다." });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ message: "유효하지 않은 토큰입니다." });
  }
};

// ----------------------
// 날짜 포맷 헬퍼
// ----------------------
function formatPostDate(createdAt) {
  const postDate = new Date(createdAt);
  const now = new Date();

  const isToday =
    postDate.getFullYear() === now.getFullYear() &&
    postDate.getMonth() === now.getMonth() &&
    postDate.getDate() === now.getDate();

  if (isToday) {
    const hours = String(postDate.getHours()).padStart(2, "0");
    const minutes = String(postDate.getMinutes()).padStart(2, "0");
    return `${hours}:${minutes}`;
  } else {
    const month = String(postDate.getMonth() + 1).padStart(2, "0");
    const day = String(postDate.getDate()).padStart(2, "0");
    return `${month}-${day}`;
  }
}

// ----------------------
// 전체 게시글 조회
// ----------------------
router.get("/", async (req, res) => {
  try {
    const posts = await Post.find().sort({ createdAt: -1 });

    const formattedPosts = posts.map((post) => ({
      ...post.toObject(),
      date: formatPostDate(post.createdAt),
    }));

    res.json(formattedPosts);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "서버 오류가 발생했습니다." });
  }
});

// ----------------------
// 게시글 작성
// ----------------------
router.post("/", verifyToken, async (req, res) => {
  try {
    const { title, content, category } = req.body;

    const lastPost = await Post.findOne().sort({ number: -1 });
    const number = lastPost ? lastPost.number + 1 : 1;

    const newPost = await Post.create({
      number,
      title,
      content,
      category: category || "자유",
      author: req.user.userId,
    });

    res.status(201).json(newPost);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "게시글 생성 실패", error: error.message });
  }
});

router.get("/:id", async (req, res) => {
  const { id } = req.params;

  if (!id) {
    return res.status(400).json({ message: "게시글 ID가 필요합니다." });
  }
  try {
    const post = await Post.findById(id);
    if (!post) {
      return res.status(404).json({ message: "게시글을 찾을 수 없습니다." });
    }
    res.json(post);
  } catch (error) {
    console.log(error);
  }
});

export default router;
