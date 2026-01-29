import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import axios from "axios";

export default function PostDetailPage() {
  const { id } = useParams(); // /post/:id
  const navigate = useNavigate();
  const { user } = useAuth();

  const [post, setPost] = useState(null);
  const [comments, setComments] = useState([]);
  const [comment, setComment] = useState("");

  // 게시글 불러오기
  useEffect(() => {
    const fetchPost = async () => {
      const res = await axios.get(`http://localhost:3000/post/${id}`);
      setPost(res.data);
    };
    console.log("확인:", id);

    // const fetchComments = async () => {
    //   const res = await axios.get(`http://localhost:3000/post/${id}/comments`);
    //   setComments(res.data);
    // };

    fetchPost();
    // fetchComments();
  }, [id]);

  // 댓글 등록
  const handleCommentSubmit = async (e) => {
    e.preventDefault();

    if (!user) {
      alert("로그인 후 댓글을 작성할 수 있습니다.");
      return;
    }

    if (comment.trim().length < 2) {
      alert("댓글은 2자 이상 입력해주세요.");
      return;
    }

    const payload = {
      content: comment,
      userId: user.id,
      postId: id,
    };

    await axios.post("http://localhost:3000/comment", payload, {
      withCredentials: true,
    });

    setComment("");

    // 댓글 다시 불러오기
    const res = await axios.get(`http://localhost:3000/post/${id}/comments`);
    setComments(res.data);
  };

  if (!post) return <div className="text-center py-20">로딩중...</div>;

  return (
    <div className="bg-white min-h-screen py-10">
      <div className="max-w-4xl mx-auto border border-gray-300">
        {/* 헤더 */}
        <div className="px-6 py-4 border-b border-gray-300 bg-gray-200">
          <h2 className="text-xl font-bold">{post.title}</h2>
          <p className="text-sm text-gray-600 mt-1">
            작성자: {post.user?.nickname || "익명"} · {post.createdAt}
          </p>
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
              <div key={c.id} className="border-b pb-2">
                <p className="text-sm">{c.content}</p>
                <p className="text-xs text-gray-500 mt-1">
                  {c.user?.nickname || "익명"} · {c.createdAt}
                </p>
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
