import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import axios from "axios";
import { PostDetailSkeleton } from "../../Components/items/Skeleton";

export default function PostDetailPage() {
  const { id } = useParams();
  const API = process.env.NEXT_PUBLIC_API_URL;
  const navigate = useNavigate();
  const { user } = useAuth();

  const [post, setPost] = useState(null);
  const [comments, setComments] = useState([]);
  const [comment, setComment] = useState("");
  const isAdmin = user?.admin === true;

  useEffect(() => {
    const fetchPost = async () => {
      const res = await axios.get(`${API}/post/${id}`, {
        withCredentials: true,
      });
      setPost(res.data);
    };

    const fetchComments = async () => {
      const res = await axios.get(`${API}/post/${id}/comments`);
      setComments(res.data);
    };

    fetchPost();
    fetchComments();
  }, [id]);

  // 댓글 등록
  const handleCommentSubmit = async (e) => {
    e.preventDefault();

    if (!user) {
      alert("로그인 후 댓글을 작성할 수 있습니다.");
      return;
    }
    try {
      const payload = {
        content: comment,
        userId: user.userId,
        author: user.userName,
      };

      const response = await axios.post(`${API}/post/${id}/comment`, payload, { withCredentials: true });

      if (response) {
        setComment("");
        alert("댓글이 작성되었습니다.");

        const res = await axios.get(`${API}/post/${id}/comments`);
        setComments(res.data);
      }
    } catch (error) {
      if (error.response) {
        alert(error.response.data.message);
      } else {
        alert("서버에 연결할 수 없습니다. 다시 시도해주세요.");
      }
    }
  };

  //게시판 삭제
  const handleDelete = async () => {
    const ok = window.confirm("정말 삭제하시겠습니까?");
    if (!ok) return;
    try {
      const res = await axios.delete(`${API}/post/${id}`, {
        withCredentials: true,
      });

      if (res.status === 200) {
        alert("게시글이 삭제되었습니다.");
        navigate("/board");
      }
    } catch (error) {
      if (error.response) {
        alert(error.response.data.message);
      } else {
        alert("서버에 연결할 수 없습니다. 다시 시도해주세요.");
      }
    }
  };

  //댓글 삭제
  const handleCommentDelete = async (commentId, commentUserId) => {
    if (!user || (user.userId !== commentUserId && !isAdmin)) {
      alert("삭제 권한이 없습니다.");
      return;
    }

    const ok = window.confirm("정말 삭제하시겠습니까?");
    if (!ok) return;

    try {
      const res = await axios.delete(`${API}/post/${id}/comment/${commentId}`, {
        withCredentials: true,
      });

      if (res.status === 200) {
        // 삭제 후 상태에서 댓글 제거
        setComments((prev) => prev.filter((c) => c._id !== commentId));
        alert("댓글이 삭제되었습니다.");
      }
    } catch (error) {
      console.log(error);
      alert("댓글 삭제 실패");
    }
  };

  if (!post) return <PostDetailSkeleton />;

  return (
    <div className="bg-white min-h-screen py-10">
      <div className="max-w-4xl mx-auto border border-gray-300">
        {/* 헤더 */}
        <div className="flex justify-between px-6 py-4 border-b border-gray-300 bg-gray-200">
          {/* 왼쪽 영역 */}
          <div className="max-w-2xl">
            <h2 className="text-xl font-bold truncate">{post.title}</h2>
            <p className="text-sm text-gray-600 mt-1">
              작성자: {post.author} · {post.createdAt}
            </p>
          </div>

          {/* 오른쪽 버튼 영역 (작성자만 보여줌) */}
          {user && (post.userId.toString() === user.userId || isAdmin) && (
            <div className="flex ml-3 py-1 text-gray-600 text-sm space-x-2">
              <button type="button" onClick={() => navigate(`/board/edit/${id}`)} className="h-2 hover:text-gray-700">
                수정
              </button>
              <button type="button" className="h-2 hover:text-gray-700" onClick={handleDelete}>
                삭제
              </button>
            </div>
          )}
        </div>
        {/* 본문 */}
        <div className="p-6 min-h-[30rem] bg-gray-50 whitespace-pre-wrap leading-relaxed text-sm">{post.content}</div>
        {/* 하단 버튼 */}
        <div className="flex justify-between px-6 py-4 border-t border-gray-200">
          <button
            onClick={() => navigate(-1)}
            className="px-4 py-2 text-sm border border-gray-400 text-gray-600 hover:bg-gray-200"
          >
            목록으로
          </button>
        </div>
        {/* 댓글 영역 */}
        <div className="px-6 py-4 border-t border-gray-300 bg-white">
          <h3 className="font-semibold mb-3">댓글 {comments.length}개</h3>

          {/* 댓글 목록 */}
          <div className="space-y-3 mb-6">
            {comments.map((c) => (
              <div key={c._id} className="border-b pb-2 flex justify-between items-start">
                <div>
                  <p className="text-sm">{c.content}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    {c.author} · {c.createdAt}
                  </p>
                </div>

                {((user && c.userId === user.userId) || isAdmin) && (
                  <button
                    onClick={() => handleCommentDelete(c._id, c.userId)}
                    className="text-xs text-red-500 hover:text-red-700 ml-2"
                  >
                    삭제
                  </button>
                )}
              </div>
            ))}

            {comments.length === 0 && <p className="text-sm text-gray-400">아직 댓글이 없습니다.</p>}
          </div>

          {/* 댓글 작성 */}
          <form onSubmit={handleCommentSubmit} className="flex gap-2">
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="댓글을 입력하세요"
              className="
                flex-1 h-20 p-2 text-sm
                border border-gray-300 resize-none
                focus:outline-none focus:border-blue-600
              "
            />
            <button
              type="submit"
              className="
                px-4 py-2 text-sm font-semibold
                bg-gray-700 text-white
                hover:bg-gray-800
              "
            >
              등록
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
