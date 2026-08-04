import express from "express";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import AnimeComment from "../models/AnimeComment.js";
import AnimeCommentVote from "../models/AnimeCommentVote.js";
import Anime from "../models/anime.js";

const router = express.Router();
const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 30;
const TOP_COMMENT_LIMIT = 3;

function verifyToken(req, res, next) {
  const token = req.cookies.token;
  if (!token) return res.status(401).json({ message: "로그인이 필요합니다." });

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    return next();
  } catch {
    return res.status(401).json({ message: "유효하지 않은 로그인 정보입니다." });
  }
}

function getOptionalUser(req) {
  const token = req.cookies.token;
  if (!token) return null;

  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return null;
  }
}

function parseAnimeId(value) {
  const animeId = Number(value);
  return Number.isInteger(animeId) && animeId > 0 ? animeId : null;
}

async function attachViewerRecommendation(comments, userId) {
  if (!userId || !comments.length) {
    return comments.map((comment) => ({ ...comment, recommended: false }));
  }

  const commentIds = comments.map((comment) => comment._id);
  const votes = await AnimeCommentVote.find({ commentId: { $in: commentIds }, userId })
    .select("commentId")
    .lean();
  const votedIds = new Set(votes.map((vote) => String(vote.commentId)));

  return comments.map((comment) => ({
    ...comment,
    recommended: votedIds.has(String(comment._id)),
  }));
}

router.get("/:animeId", async (req, res) => {
  const animeId = parseAnimeId(req.params.animeId);
  if (!animeId) return res.status(400).json({ message: "올바르지 않은 애니 ID입니다." });

  const requestedPage = Number(req.query.page);
  const requestedLimit = Number(req.query.limit);
  const page = Number.isFinite(requestedPage) ? Math.max(Math.floor(requestedPage), 1) : 1;
  const limit = Number.isFinite(requestedLimit)
    ? Math.min(Math.max(Math.floor(requestedLimit), 1), MAX_PAGE_SIZE)
    : DEFAULT_PAGE_SIZE;
  const skip = (page - 1) * limit;
  const viewer = getOptionalUser(req);

  try {
    const topComments = await AnimeComment.find({ animeId, recommendCount: { $gt: 0 } })
      .sort({ recommendCount: -1, createdAt: -1 })
      .limit(TOP_COMMENT_LIMIT)
      .lean();
    const topIds = topComments.map((comment) => comment._id);
    const regularFilter = { animeId, _id: { $nin: topIds } };

    const [comments, total] = await Promise.all([
      AnimeComment.find(regularFilter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      AnimeComment.countDocuments(regularFilter),
    ]);

    const allComments = [...topComments, ...comments];
    const decorated = await attachViewerRecommendation(allComments, viewer?.userId);
    const decoratedTop = decorated.slice(0, topComments.length);
    const decoratedComments = decorated.slice(topComments.length);

    return res.json({
      topComments: decoratedTop,
      comments: decoratedComments,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error("Anime comment list failed:", error);
    return res.status(500).json({ message: "댓글을 불러오지 못했습니다." });
  }
});

router.post("/:animeId", verifyToken, async (req, res) => {
  const animeId = parseAnimeId(req.params.animeId);
  const content = req.body.content?.trim();

  if (!animeId) return res.status(400).json({ message: "올바르지 않은 애니 ID입니다." });
  if (!content) return res.status(400).json({ message: "댓글 내용을 입력해주세요." });
  if (content.length > 1000) return res.status(400).json({ message: "댓글은 최대 1000자까지 작성할 수 있습니다." });

  try {
    const animeExists = await Anime.exists({ _id: animeId });
    if (!animeExists) return res.status(404).json({ message: "애니 정보를 찾을 수 없습니다." });

    const comment = await AnimeComment.create({
      animeId,
      userId: req.user.userId,
      author: req.user.userName,
      content,
    });
    return res.status(201).json({ ...comment.toObject(), recommended: false });
  } catch (error) {
    console.error("Anime comment creation failed:", error);
    return res.status(500).json({ message: "댓글 작성에 실패했습니다." });
  }
});

router.delete("/:animeId/:commentId", verifyToken, async (req, res) => {
  const animeId = parseAnimeId(req.params.animeId);
  const { commentId } = req.params;

  if (!animeId || !mongoose.isValidObjectId(commentId)) {
    return res.status(400).json({ message: "올바르지 않은 요청입니다." });
  }

  try {
    const deletedComment = await AnimeComment.findOneAndDelete({
      _id: commentId,
      animeId,
      userId: req.user.userId,
    });

    if (!deletedComment) {
      const exists = await AnimeComment.exists({ _id: commentId, animeId });
      return res.status(exists ? 403 : 404).json({
        message: exists ? "본인이 작성한 댓글만 삭제할 수 있습니다." : "댓글을 찾을 수 없습니다.",
      });
    }

    await AnimeCommentVote.deleteMany({ commentId }).catch((error) => {
      console.error("Deleted comment vote cleanup failed:", error);
    });

    return res.json({ commentId, message: "댓글을 삭제했습니다." });
  } catch (error) {
    console.error("Anime comment deletion failed:", error);
    return res.status(500).json({ message: "댓글 삭제에 실패했습니다." });
  }
});

function validateRecommendationParams(req, res) {
  const animeId = parseAnimeId(req.params.animeId);
  const { commentId } = req.params;

  if (!animeId || !mongoose.isValidObjectId(commentId)) {
    res.status(400).json({ message: "올바르지 않은 요청입니다." });
    return null;
  }

  return { animeId, commentId };
}

router.put("/:animeId/:commentId/recommend", verifyToken, async (req, res) => {
  const params = validateRecommendationParams(req, res);
  if (!params) return;
  const { animeId, commentId } = params;

  try {
    const comment = await AnimeComment.findOne({ _id: commentId, animeId }).select("_id");
    if (!comment) return res.status(404).json({ message: "댓글을 찾을 수 없습니다." });

    try {
      await AnimeCommentVote.create({ commentId, userId: req.user.userId });
    } catch (error) {
      if (error.code !== 11000) throw error;

      const current = await AnimeComment.findById(commentId).select("recommendCount").lean();
      return res.json({ commentId, recommended: true, recommendCount: current?.recommendCount || 0 });
    }

    try {
      const updated = await AnimeComment.findOneAndUpdate(
        { _id: commentId, animeId },
        { $inc: { recommendCount: 1 } },
        { new: true },
      ).select("recommendCount");

      if (!updated) {
        await AnimeCommentVote.deleteOne({ commentId, userId: req.user.userId });
        return res.status(404).json({ message: "댓글을 찾을 수 없습니다." });
      }

      return res.json({ commentId, recommended: true, recommendCount: updated.recommendCount });
    } catch (error) {
      await AnimeCommentVote.deleteOne({ commentId, userId: req.user.userId }).catch(() => {});
      throw error;
    }
  } catch (error) {
    console.error("Anime comment recommendation failed:", error);
    return res.status(500).json({ message: "추천 처리에 실패했습니다." });
  }
});

router.delete("/:animeId/:commentId/recommend", verifyToken, async (req, res) => {
  const params = validateRecommendationParams(req, res);
  if (!params) return;
  const { animeId, commentId } = params;

  try {
    const deletedVote = await AnimeCommentVote.findOneAndDelete({ commentId, userId: req.user.userId });

    if (!deletedVote) {
      const current = await AnimeComment.findOne({ _id: commentId, animeId }).select("recommendCount").lean();
      if (!current) return res.status(404).json({ message: "댓글을 찾을 수 없습니다." });
      return res.json({ commentId, recommended: false, recommendCount: current.recommendCount || 0 });
    }

    try {
      const updated = await AnimeComment.findOneAndUpdate(
        { _id: commentId, animeId },
        { $inc: { recommendCount: -1 } },
        { new: true },
      ).select("recommendCount");

      if (!updated) return res.status(404).json({ message: "댓글을 찾을 수 없습니다." });
      return res.json({ commentId, recommended: false, recommendCount: updated.recommendCount });
    } catch (error) {
      await AnimeCommentVote.create({ commentId, userId: req.user.userId }).catch(() => {});
      throw error;
    }
  } catch (error) {
    console.error("Anime comment recommendation cancellation failed:", error);
    return res.status(500).json({ message: "추천 취소에 실패했습니다." });
  }
});

export default router;
