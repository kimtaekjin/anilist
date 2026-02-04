import express from "express";
const router = express.Router();
import jwt from "jsonwebtoken";
import Post from "../models/Post.js";
import Counter from "../models/PostCounter.js";
import dayjs from "dayjs";
import User from "../models/User.js";

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

const optionalVerifyToken = (req, res, next) => {
  const token = req.cookies.token;

  if (!token) {
    req.user = null;
    return next();
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
  } catch (error) {
    req.user = null;
  }

  next();
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
    const posts = await Post.find().sort({ isNotice: -1, number: -1 });

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
  const { title, content, category, author, userId } = req.body;
  // console.log("확인", title, "2:", content, "3:", author);

  if (!title || !content || !author) {
    return res.status(400).json({ message: "필수 값이 누락되었습니다." });
  }

  try {
    // Counter로 number 자동 증가
    const counter = await Counter.findByIdAndUpdate(
      "post", // Counter 문서 id
      { $inc: { seq: 1 } },
      { new: true, upsert: true },
    );
    const number = counter.seq;

    const newPost = await Post.create({
      number,
      title,
      content,
      category: category || "자유",
      author,
      userId,
    });

    res.status(201).json(newPost);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "서버 오류" });
  }
});

//게시글 수정
router.put("/:id", verifyToken, async (req, res) => {
  const { id } = req.params;
  const { title, content, category } = req.body;

  if (!title || !content) {
    return res.status(400).json({ message: "필수 값이 누락되었습니다." });
  }

  try {
    const post = await Post.findById(id);

    if (!post) {
      return res.status(404).json({ message: "게시글이 존재하지 않습니다." });
    }

    if (post.userId.toString() !== req.user.userId) {
      return res.status(403).json({ message: "수정 권한이 없습니다." });
    }

    post.title = title;
    post.content = content;
    post.category = category || post.category || "자유";

    await post.save();

    res.status(200).json(post);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "서버 오류" });
  }
});

//게시글 상세보기
router.get("/:id", optionalVerifyToken, async (req, res) => {
  const { id } = req.params;
  const user = req.user;

  try {
    const post = await Post.findById(id);
    if (!post) {
      return res.status(404).json({ message: "게시글을 찾을 수 없습니다." });
    }

    if (req.user) {
      const alreadyViewed = post.viewLogs.some((log) => log.userId === user.userId);
      console.log(alreadyViewed);

      if (!alreadyViewed) {
        post.views += 1;
        post.viewLogs.push({
          userId: user.userId,
        });
        await post.save();
      }
    }
    const formattedPost = {
      ...post.toObject(),
      createdAt: dayjs(post.createdAt).format("YYYY-MM-DD HH:mm:ss"),
    };

    res.json(formattedPost);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "서버 오류" });
  }
});
//게시글 삭제
router.delete("/:id", verifyToken, async (req, res) => {
  const { id } = req.params;

  try {
    const post = await Post.findById(id);
    if (!post) return res.status(404).json({ message: "게시글이 존재하지 않습니다." });

    if (post.userId.toString() !== req.user.userId && !req.user.admin) {
      return res.status(403).json({ message: "삭제 권한이 없습니다." });
    }

    await post.deleteOne();
    res.json({ message: "게시글이 삭제되었습니다." });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "서버 오류" });
  }
});

//댓글 달기
router.post("/:id/comment", verifyToken, async (req, res) => {
  const { id } = req.params;
  const { userId, content, author } = req.body;

  if (!content || !author) {
    return res.status(400).json({ message: "내용을 작성해 주세요." });
  }

  try {
    const post = await Post.findById(id);
    if (!post) return res.status(404).json({ message: "게시글이 없습니다." });

    post.comments.push({ author, content, userId });
    await post.save();

    res.status(201).json(post.comments);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "서버 오류" });
  }
});

//댓글 보기
router.get("/:id/comments", async (req, res) => {
  const { id } = req.params;

  try {
    const post = await Post.findById(id);
    if (!post) return res.status(404).json({ message: "게시글이 없습니다." });

    const comments = post.comments.map((comment) => ({
      ...comment.toObject(),
      createdAt: dayjs(comment.createdAt).format("YYYY-MM-DD HH:mm:ss"),
    }));

    res.status(201).json(comments);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "서버 오류" });
  }
});

//댓글 삭제
router.delete("/:postId/comment/:commentId", verifyToken, async (req, res) => {
  const { postId, commentId } = req.params;

  try {
    const post = await Post.findById(postId);
    if (!post) return res.status(404).json({ message: "게시글이 존재하지 않습니다." });

    const comment = post.comments.id(commentId);
    if (!comment) return res.status(404).json({ message: "댓글이 존재하지 않습니다." });

    if (comment.userId.toString() !== req.user.userId && !req.user.admin) {
      return res.status(403).json({ message: "삭제 권한이 없습니다." });
    }

    await comment.deleteOne();
    await post.save();

    res.status(200).json({ message: "댓글이 삭제되었습니다." });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "서버 오류" });
  }
});

export default router;
