import express from "express";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import dayjs from "dayjs";
import Post from "../models/Post.js";
import Counter from "../models/PostCounter.js";

const router = express.Router();

router.use(express.json());

const DEFAULT_CATEGORY = "자유";
const MAX_PAGE_SIZE = 50;

const messages = {
  authRequired: "인증이 필요합니다.",
  invalidToken: "유효하지 않은 토큰입니다.",
  requiredFields: "제목과 내용을 입력해주세요.",
  invalidPostId: "올바르지 않은 게시글 ID입니다.",
  invalidCommentId: "올바르지 않은 댓글 ID입니다.",
  postNotFound: "게시글이 존재하지 않습니다.",
  commentNotFound: "댓글이 존재하지 않습니다.",
  editForbidden: "수정 권한이 없습니다.",
  deleteForbidden: "삭제 권한이 없습니다.",
  postDeleted: "게시글을 삭제했습니다.",
  commentRequired: "댓글 내용을 입력해주세요.",
  commentDeleted: "댓글을 삭제했습니다.",
  serverError: "서버 오류가 발생했습니다.",
};

const verifyToken = (req, res, next) => {
  const token = req.cookies.token;
  if (!token) return res.status(401).json({ message: messages.authRequired });

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch (error) {
    return res.status(401).json({ message: messages.invalidToken });
  }
};

const optionalVerifyToken = (req, res, next) => {
  const token = req.cookies.token;
  if (!token) {
    req.user = null;
    return next();
  }

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    req.user = null;
  }

  next();
};

function isValidId(id) {
  return mongoose.isValidObjectId(id);
}

function formatPostDate(createdAt) {
  const postDate = dayjs(createdAt);
  const now = dayjs();
  return postDate.isSame(now, "day") ? postDate.format("HH:mm") : postDate.format("MM-DD");
}

function formatComment(comment) {
  const raw = typeof comment.toObject === "function" ? comment.toObject() : comment;
  return {
    ...raw,
    createdAt: dayjs(raw.createdAt).format("YYYY-MM-DD HH:mm:ss"),
  };
}

function getViewerKey(req) {
  if (req.user?.userId) {
    return { type: "user", userId: req.user.userId };
  }

  return {
    type: "guest",
    ip: req.ip,
    userAgent: req.get("user-agent") || "",
  };
}

function hasViewed(viewLogs, viewerKey) {
  if (viewerKey.type === "user") {
    return viewLogs.some((log) => log.userId === viewerKey.userId);
  }

  return viewLogs.some((log) => log.ip === viewerKey.ip && log.userAgent === viewerKey.userAgent);
}

// 게시글 목록
router.get("/", async (req, res) => {
  try {
    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(req.query.limit) || 15, 1), MAX_PAGE_SIZE);
    const skip = (page - 1) * limit;

    const [posts, total] = await Promise.all([
      Post.find()
        .sort({ isNotice: -1, number: -1 })
        .skip(skip)
        .limit(limit)
        .select("number title author category comments recommend isNotice views createdAt")
        .lean(),
      Post.countDocuments(),
    ]);

    const items = posts.map((post) => ({
      ...post,
      commentCount: post.comments?.length || 0,
      comments: undefined,
      date: formatPostDate(post.createdAt),
    }));

    res.json({ items, total, page, limit });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: messages.serverError });
  }
});

// 게시글 작성
router.post("/", verifyToken, async (req, res) => {
  const title = req.body.title?.trim();
  const content = req.body.content?.trim();
  const category = req.body.category?.trim() || DEFAULT_CATEGORY;

  if (!title || !content) {
    return res.status(400).json({ message: messages.requiredFields });
  }

  try {
    const counter = await Counter.findByIdAndUpdate("post", { $inc: { seq: 1 } }, { new: true, upsert: true });

    const newPost = await Post.create({
      number: counter.seq,
      title,
      content,
      category,
      author: req.user.userName,
      userId: req.user.userId,
    });

    res.status(201).json(newPost);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: messages.serverError });
  }
});

// 게시글 수정
router.put("/:id", verifyToken, async (req, res) => {
  const { id } = req.params;
  const title = req.body.title?.trim();
  const content = req.body.content?.trim();
  const category = req.body.category?.trim();

  if (!isValidId(id)) return res.status(400).json({ message: messages.invalidPostId });
  if (!title || !content) return res.status(400).json({ message: messages.requiredFields });

  try {
    const post = await Post.findById(id);
    if (!post) return res.status(404).json({ message: messages.postNotFound });

    if (post.userId !== req.user.userId) {
      return res.status(403).json({ message: messages.editForbidden });
    }

    post.title = title;
    post.content = content;
    post.category = category || post.category || DEFAULT_CATEGORY;

    await post.save();
    res.status(200).json(post);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: messages.serverError });
  }
});

// 게시글 상세
router.get("/:id", optionalVerifyToken, async (req, res) => {
  const { id } = req.params;

  if (!isValidId(id)) return res.status(400).json({ message: messages.invalidPostId });

  try {
    const post = await Post.findById(id);
    if (!post) return res.status(404).json({ message: messages.postNotFound });

    const viewerKey = getViewerKey(req);
    if (!hasViewed(post.viewLogs, viewerKey)) {
      post.views += 1;
      post.viewLogs.push({
        userId: viewerKey.userId,
        ip: viewerKey.ip,
        userAgent: viewerKey.userAgent,
      });
      await post.save();
    }

    const formattedPost = {
      ...post.toObject(),
      createdAt: dayjs(post.createdAt).format("YYYY-MM-DD HH:mm:ss"),
      updatedAt: dayjs(post.updatedAt).format("YYYY-MM-DD HH:mm:ss"),
    };

    res.json(formattedPost);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: messages.serverError });
  }
});

// 게시글 삭제
router.delete("/:id", verifyToken, async (req, res) => {
  const { id } = req.params;

  if (!isValidId(id)) return res.status(400).json({ message: messages.invalidPostId });

  try {
    const post = await Post.findById(id);
    if (!post) return res.status(404).json({ message: messages.postNotFound });

    if (post.userId !== req.user.userId && !req.user.admin) {
      return res.status(403).json({ message: messages.deleteForbidden });
    }

    await post.deleteOne();
    res.json({ message: messages.postDeleted });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: messages.serverError });
  }
});

// 댓글 작성
router.post("/:id/comment", verifyToken, async (req, res) => {
  const { id } = req.params;
  const content = req.body.content?.trim();

  if (!isValidId(id)) return res.status(400).json({ message: messages.invalidPostId });
  if (!content) return res.status(400).json({ message: messages.commentRequired });

  try {
    const post = await Post.findById(id);
    if (!post) return res.status(404).json({ message: messages.postNotFound });

    post.comments.push({
      author: req.user.userName,
      content,
      userId: req.user.userId,
    });
    await post.save();

    const latestComment = post.comments[post.comments.length - 1];
    res.status(201).json(formatComment(latestComment));
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: messages.serverError });
  }
});

// 댓글 목록
router.get("/:id/comments", async (req, res) => {
  const { id } = req.params;

  if (!isValidId(id)) return res.status(400).json({ message: messages.invalidPostId });

  try {
    const post = await Post.findById(id).select("comments");
    if (!post) return res.status(404).json({ message: messages.postNotFound });

    const comments = post.comments.map(formatComment);
    res.status(200).json(comments);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: messages.serverError });
  }
});

// 댓글 삭제
router.delete("/:postId/comment/:commentId", verifyToken, async (req, res) => {
  const { postId, commentId } = req.params;

  if (!isValidId(postId)) return res.status(400).json({ message: messages.invalidPostId });
  if (!isValidId(commentId)) return res.status(400).json({ message: messages.invalidCommentId });

  try {
    const post = await Post.findById(postId);
    if (!post) return res.status(404).json({ message: messages.postNotFound });

    const comment = post.comments.id(commentId);
    if (!comment) return res.status(404).json({ message: messages.commentNotFound });

    if (comment.userId !== req.user.userId && !req.user.admin) {
      return res.status(403).json({ message: messages.deleteForbidden });
    }

    post.comments.pull(commentId);
    await post.save();

    res.status(200).json({ message: messages.commentDeleted });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: messages.serverError });
  }
});

export default router;
