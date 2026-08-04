import { useCallback, useEffect, useState } from "react";
import axios from "axios";
import { Crown, ThumbsUp, Trash2 } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import Pagination from "../../Components/Pagination/Pagination";

const PAGE_SIZE = 10;

function CommentCard({ comment, featured, onRecommend, recommending, canDelete, onDelete, deleting }) {
  return (
    <article
      className={`rounded-xl border p-4 ${
        featured ? "border-amber-400/30 bg-amber-400/10" : "border-stone-100/10 bg-[#181816]"
      }`}
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          {featured && <Crown size={16} className="shrink-0 text-amber-300" />}
          <strong className="truncate text-sm text-stone-100">{comment.author}</strong>
          <time className="shrink-0 text-xs text-stone-500">
            {new Date(comment.createdAt).toLocaleString("ko-KR")}
          </time>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {canDelete && (
            <button
              type="button"
              disabled={deleting || recommending}
              onClick={() => onDelete(comment._id)}
              className="inline-flex items-center gap-1 rounded-full border border-stone-100/15 px-3 py-1 text-xs font-bold text-stone-400 transition hover:border-red-400/50 hover:text-red-200 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Trash2 size={14} />
              삭제
            </button>
          )}
          <button
            type="button"
            disabled={recommending || deleting}
            onClick={() => onRecommend(comment._id)}
            className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-bold transition disabled:cursor-not-allowed disabled:opacity-50 ${
              comment.recommended
                ? "border-red-400/50 bg-red-500/15 text-red-200"
                : "border-stone-100/15 text-stone-400 hover:border-red-400/50 hover:text-red-200"
            }`}
          >
            <ThumbsUp size={14} />
            추천 {comment.recommendCount || 0}
          </button>
        </div>
      </div>
      <p className="whitespace-pre-wrap break-words text-sm leading-6 text-stone-200">{comment.content}</p>
    </article>
  );
}

export default function AnimeComments({ animeId }) {
  const API_URL = process.env.REACT_APP_CLIENT_URL;
  const { user } = useAuth();
  const [topComments, setTopComments] = useState([]);
  const [comments, setComments] = useState([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [recommendingId, setRecommendingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  const loadComments = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const { data } = await axios.get(`${API_URL}/anime-comments/${animeId}`, {
        params: { page, limit: PAGE_SIZE },
        withCredentials: true,
      });
      setTopComments(data.topComments || []);
      setComments(data.comments || []);
      setTotal(data.total || 0);
      const lastPage = Math.max(Math.ceil((data.total || 0) / PAGE_SIZE), 1);
      if (page > lastPage) setPage(lastPage);
    } catch (requestError) {
      console.error(requestError);
      setError("댓글을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, [API_URL, animeId, page]);

  useEffect(() => {
    loadComments();
  }, [loadComments]);

  const submitComment = async (event) => {
    event.preventDefault();
    if (!user) {
      alert("로그인 후 댓글을 작성할 수 있습니다.");
      return;
    }
    if (!content.trim() || submitting) return;

    try {
      setSubmitting(true);
      await axios.post(
        `${API_URL}/anime-comments/${animeId}`,
        { content: content.trim() },
        { withCredentials: true },
      );
      setContent("");
      if (page !== 1) setPage(1);
      else await loadComments();
    } catch (requestError) {
      alert(requestError.response?.data?.message || "댓글 작성에 실패했습니다.");
    } finally {
      setSubmitting(false);
    }
  };

  const recommendComment = async (commentId) => {
    if (!user) {
      alert("로그인 후 추천할 수 있습니다.");
      return;
    }
    if (recommendingId) return;

    try {
      setRecommendingId(commentId);
      const targetComment = [...topComments, ...comments].find((comment) => comment._id === commentId);
      const method = targetComment?.recommended ? "delete" : "put";
      await axios({
        method,
        url: `${API_URL}/anime-comments/${animeId}/${commentId}/recommend`,
        withCredentials: true,
      });
      await loadComments();
    } catch (requestError) {
      alert(requestError.response?.data?.message || "추천 처리에 실패했습니다.");
    } finally {
      setRecommendingId(null);
    }
  };

  const deleteComment = async (commentId) => {
    if (!user || deletingId) return;
    if (!window.confirm("댓글을 삭제하시겠습니까?")) return;

    try {
      setDeletingId(commentId);
      await axios.delete(`${API_URL}/anime-comments/${animeId}/${commentId}`, {
        withCredentials: true,
      });
      await loadComments();
    } catch (requestError) {
      alert(requestError.response?.data?.message || "댓글 삭제에 실패했습니다.");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <section className="mt-12 border-t border-stone-100/10 pt-8">
      <h2 className="mb-5 text-2xl font-bold text-stone-50">댓글</h2>

      <form onSubmit={submitComment} className="mb-8 rounded-xl border border-stone-100/10 bg-[#181816] p-4">
        <textarea
          value={content}
          maxLength={1000}
          onChange={(event) => setContent(event.target.value)}
          placeholder={user ? "이 애니에 대한 의견을 남겨주세요." : "로그인 후 댓글을 작성할 수 있습니다."}
          className="h-28 w-full resize-none rounded-lg border border-stone-100/10 bg-[#10100f] p-3 text-sm leading-6 text-stone-100 outline-none placeholder:text-stone-500 focus:border-amber-500"
        />
        <div className="mt-3 flex items-center justify-between">
          <span className="text-xs text-stone-500">{content.length}/1000</span>
          <button
            type="submit"
            disabled={submitting || !content.trim()}
            className="rounded-md bg-red-600 px-5 py-2 text-sm font-bold text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? "등록 중..." : "댓글 등록"}
          </button>
        </div>
      </form>

      {topComments.length > 0 && (
        <div className="mb-8">
          <h3 className="mb-3 flex items-center gap-2 font-bold text-amber-200">
            <Crown size={18} /> 추천 상위 댓글
          </h3>
          <div className="space-y-3">
            {topComments.map((comment) => (
              <CommentCard
                key={comment._id}
                comment={comment}
                featured
                onRecommend={recommendComment}
                recommending={recommendingId === comment._id}
                canDelete={user?.userId === comment.userId}
                onDelete={deleteComment}
                deleting={deletingId === comment._id}
              />
            ))}
          </div>
        </div>
      )}

      {loading && <p className="py-10 text-center text-sm text-stone-400">댓글을 불러오는 중...</p>}
      {!loading && error && <p className="py-10 text-center text-sm text-red-300">{error}</p>}
      {!loading && !error && comments.length === 0 && (
        <p className="py-10 text-center text-sm text-stone-500">등록된 일반 댓글이 없습니다.</p>
      )}
      {!loading && !error && (
        <div className="space-y-3">
          {comments.map((comment) => (
            <CommentCard
              key={comment._id}
              comment={comment}
              onRecommend={recommendComment}
              recommending={recommendingId === comment._id}
              canDelete={user?.userId === comment.userId}
              onDelete={deleteComment}
              deleting={deletingId === comment._id}
            />
          ))}
        </div>
      )}

      <Pagination
        currentPage={page}
        totalItems={total}
        itemsPerPage={PAGE_SIZE}
        onPageChange={setPage}
      />
    </section>
  );
}
