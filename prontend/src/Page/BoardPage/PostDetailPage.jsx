import { useCallback, useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import axios from "axios";
import { PostDetailSkeleton } from "../../Components/items/Skeleton";

const TEXT = {
  loginRequiredForComment: "\uB85C\uADF8\uC778 \uD6C4 \uB313\uAE00\uC744 \uC791\uC131\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4.",
  commentRequired: "\uB313\uAE00\uC744 \uC785\uB825\uD574\uC8FC\uC138\uC694.",
  commentCreated: "\uB313\uAE00\uC744 \uC791\uC131\uD588\uC2B5\uB2C8\uB2E4.",
  serverError: "\uC11C\uBC84\uC5D0 \uC5F0\uACB0\uD560 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4. \uB2E4\uC2DC \uC2DC\uB3C4\uD574\uC8FC\uC138\uC694.",
  deleteConfirm: "\uC815\uB9D0 \uC0AD\uC81C\uD558\uC2DC\uACA0\uC2B5\uB2C8\uAE4C?",
  postDeleted: "\uAC8C\uC2DC\uAE00\uC744 \uC0AD\uC81C\uD588\uC2B5\uB2C8\uB2E4.",
  noPermission: "\uC0AD\uC81C \uAD8C\uD55C\uC774 \uC5C6\uC2B5\uB2C8\uB2E4.",
  author: "\uC791\uC131\uC790",
  edit: "\uC218\uC815",
  delete: "\uC0AD\uC81C",
  backToList: "\uBAA9\uB85D\uC73C\uB85C",
  comments: "\uB313\uAE00",
  noComments: "\uC544\uC9C1 \uB313\uAE00\uC774 \uC5C6\uC2B5\uB2C8\uB2E4.",
  commentPlaceholder: "\uB313\uAE00\uC744 \uC785\uB825\uD558\uC138\uC694",
  submit: "\uB4F1\uB85D",
};

export default function PostDetailPage() {
  const { id } = useParams();
  const API_URL = process.env.REACT_APP_CLIENT_URL;
  const navigate = useNavigate();
  const { user } = useAuth();

  const [post, setPost] = useState(null);
  const [comments, setComments] = useState([]);
  const [comment, setComment] = useState("");
  const isAdmin = user?.admin === true;

  const fetchComments = useCallback(async () => {
    const res = await axios.get(`${API_URL}/post/${id}/comments`);
    setComments(Array.isArray(res.data) ? res.data : []);
  }, [API_URL, id]);

  useEffect(() => {
    const fetchPost = async () => {
      const res = await axios.get(`${API_URL}/post/${id}`, {
        withCredentials: true,
      });
      setPost(res.data);
    };

    fetchPost();
    fetchComments();
  }, [id, API_URL, fetchComments]);

  const handleCommentSubmit = async (e) => {
    e.preventDefault();

    if (!user) {
      alert(TEXT.loginRequiredForComment);
      return;
    }

    if (!comment.trim()) {
      alert(TEXT.commentRequired);
      return;
    }

    try {
      const response = await axios.post(
        `${API_URL}/post/${id}/comment`,
        { content: comment.trim() },
        { withCredentials: true }
      );

      if (response) {
        setComment("");
        alert(TEXT.commentCreated);
        await fetchComments();
      }
    } catch (error) {
      if (error.response) {
        alert(error.response.data.message);
      } else {
        alert(TEXT.serverError);
      }
    }
  };

  const handleDelete = async () => {
    const ok = window.confirm(TEXT.deleteConfirm);
    if (!ok) return;

    try {
      const res = await axios.delete(`${API_URL}/post/${id}`, {
        withCredentials: true,
      });

      if (res.status === 200) {
        alert(TEXT.postDeleted);
        navigate("/board");
      }
    } catch (error) {
      if (error.response) {
        alert(error.response.data.message);
      } else {
        alert(TEXT.serverError);
      }
    }
  };

  const handleCommentDelete = async (commentId, commentUserId) => {
    if (!user || (user.userId !== commentUserId && !isAdmin)) {
      alert(TEXT.noPermission);
      return;
    }

    const ok = window.confirm(TEXT.deleteConfirm);
    if (!ok) return;

    try {
      const res = await axios.delete(`${API_URL}/post/${id}/comment/${commentId}`, {
        withCredentials: true,
      });

      if (res.status === 200) {
        setComments((prev) => prev.filter((c) => c._id !== commentId));
        alert(res.data.message);
      }
    } catch (error) {
      if (error.response) {
        alert(error.response.data.message);
      } else {
        alert(TEXT.serverError);
      }
    }
  };

  if (!post) return <PostDetailSkeleton />;

  const isAuthor = user && post.userId?.toString() === user.userId;

  return (
    <section className="mx-auto min-h-screen max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
      <article className="overflow-hidden rounded-lg border border-stone-100/10 bg-[#181816] shadow-xl shadow-black/25">
        <header className="flex flex-col gap-4 border-b border-stone-100/10 bg-stone-100/5 px-6 py-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h2 className="truncate text-2xl font-bold text-stone-50">{post.title}</h2>
            <p className="mt-2 text-sm text-stone-400">
              {TEXT.author} {post.author} <span className="mx-2 text-stone-600">/</span> {post.createdAt}
            </p>
          </div>

          {user && (
            <div className="flex shrink-0 items-center gap-2 text-sm font-semibold">
              {isAuthor && (
                <button
                  type="button"
                  onClick={() => navigate(`/board/edit/${id}`)}
                  className="rounded-md border border-amber-400/30 px-3 py-1.5 text-amber-200 transition hover:bg-amber-400/10"
                >
                  {TEXT.edit}
                </button>
              )}

              {(isAuthor || isAdmin) && (
                <button
                  type="button"
                  onClick={handleDelete}
                  className="rounded-md border border-red-400/30 px-3 py-1.5 text-red-200 transition hover:bg-red-500/10"
                >
                  {TEXT.delete}
                </button>
              )}
            </div>
          )}
        </header>

        <div className="min-h-[30rem] whitespace-pre-wrap bg-[#10100f] p-6 text-sm leading-7 text-stone-100">
          {post.content}
        </div>

        <div className="flex justify-between border-t border-stone-100/10 px-6 py-4">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="rounded-md border border-stone-100/15 px-4 py-2 text-sm font-semibold text-stone-300 transition hover:border-amber-500 hover:text-amber-300"
          >
            {TEXT.backToList}
          </button>
        </div>

        <section className="border-t border-stone-100/10 bg-[#151513] px-6 py-5">
          <h3 className="mb-4 font-bold text-stone-100">
            {TEXT.comments} <span className="text-amber-300">{comments.length}</span>
          </h3>

          <div className="mb-6 space-y-3">
            {comments.map((c) => (
              <div
                key={c._id}
                className="flex items-start justify-between gap-3 rounded-md border border-stone-100/10 bg-[#10100f] p-4"
              >
                <div className="min-w-0">
                  <p className="whitespace-pre-wrap text-sm leading-6 text-stone-100">{c.content}</p>
                  <p className="mt-2 text-xs text-stone-500">
                    {c.author} <span className="mx-1 text-stone-700">/</span> {c.createdAt}
                  </p>
                </div>

                {((user && c.userId === user.userId) || isAdmin) && (
                  <button
                    type="button"
                    onClick={() => handleCommentDelete(c._id, c.userId)}
                    className="shrink-0 text-xs font-bold text-red-300 transition hover:text-red-200"
                  >
                    {TEXT.delete}
                  </button>
                )}
              </div>
            ))}

            {comments.length === 0 && <p className="text-sm text-stone-500">{TEXT.noComments}</p>}
          </div>

          <form onSubmit={handleCommentSubmit} className="flex flex-col gap-3 sm:flex-row">
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder={TEXT.commentPlaceholder}
              className="h-24 flex-1 resize-none rounded-md border border-stone-100/10 bg-[#10100f] p-3 text-sm leading-6 text-stone-100 outline-none transition placeholder:text-stone-500 focus:border-amber-500 focus:ring-4 focus:ring-amber-500/15"
            />
            <button
              type="submit"
              className="rounded-md bg-red-600 px-5 py-2 text-sm font-bold text-white transition hover:bg-red-500 focus:outline-none focus:ring-4 focus:ring-red-500/20 sm:self-stretch"
            >
              {TEXT.submit}
            </button>
          </form>
        </section>
      </article>
    </section>
  );
}
