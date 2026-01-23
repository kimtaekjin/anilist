const express = require("express");
const router = express.Router();
const Post = require("../models/Post");
const jwt = require("jsonwebtoken");

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

function formatPostDate(createdAt) {
  const postDate = new Date(createdAt);
  const now = new Date();

  // 오늘인지 확인
  const isToday =
    postDate.getFullYear() === now.getFullYear() &&
    postDate.getMonth() === now.getMonth() &&
    postDate.getDate() === now.getDate();

  if (isToday) {
    // 오늘이면 시간 표시
    const hours = String(postDate.getHours()).padStart(2, "0");
    const minutes = String(postDate.getMinutes()).padStart(2, "0");
    return `${hours}:${minutes}`;
  } else {
    // 오늘이 아니면 MM-DD 표시
    const month = String(postDate.getMonth() + 1).padStart(2, "0");
    const day = String(postDate.getDate()).padStart(2, "0");
    return `${month}-${day}`;
  }
}

router.get("/", async (req, res) => {
  try {
    const posts = await Post.find().sort({ createdAt: -1 });

    // createdAt을 포맷해서 새로운 필드 추가
    const formattedPosts = posts.map((post) => ({
      ...post.toObject(), // Mongoose 문서를 일반 JS 객체로 변환
      date: formatPostDate(post.createdAt), // 오늘/어제 기준 포맷
    }));

    res.json(formattedPosts);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "서버 오류가 발생했습니다." });
  }
});

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
      author: req.body.id,
    });

    res.status(201).json(newPost);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "게시글 생성 실패", error: error.message });
  }
});

module.exports = router;
