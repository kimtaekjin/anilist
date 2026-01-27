import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import axios from "axios";

export default function PostWritePage() {
  const navigate = useNavigate();
  const { user, isLogin } = useAuth;

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  console.log(user);

  useEffect(() => {
    if (!isLogin) {
      alert("로그인 후 이용해주시길 바랍니다.");
      navigate("/");
    }
  }, [isLogin, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!title.trim()) {
      alert("제목을 입력해주세요.");
      return;
    }

    if (content.trim().length < 10) {
      alert("내용은 10자 이상 입력해주세요.");
      return;
    }

    const payload = {
      title,
      content,
      userId: user.id,
    };

    console.log(payload);

    const submit = await axios.post("http://localhost:3000/post", payload, {
      withCredentials: true,
    });
  };

  return (
    <div className="bg-white min-h-screen py-10">
      <div className="max-w-4xl mx-auto  border border-gray-300">
        {/* 헤더 */}
        <div className="px-6 py-4 border-b border-gray-300 bg-gray-200">
          <h2 className="text-xl font-bold">자유게시판 글쓰기</h2>
          <p className="text-sm text-gray-500 mt-1">욕설, 광고, 분쟁 유도 글은 삭제될 수 있습니다.</p>
        </div>

        {/* 폼 */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 bg-gray-50">
          {/* 제목 */}
          <div>
            <input
              type="text"
              value={title}
              maxLength={100}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="제목을 입력하세요"
              className="
                w-full h-11 px-3
                border border-gray-300
                text-base
                focus:outline-none focus:border-blue-600
              "
            />
            <p className="mt-1 text-xs text-gray-500">제목은 최대 100자까지 입력 가능합니다.</p>
          </div>

          {/* 내용 */}
          <div>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="내용을 입력하세요"
              className="
                w-full h-96 p-3
                border border-gray-300
                text-sm leading-relaxed
                resize-none
                focus:outline-none focus:border-blue-600
              "
            />
            <p className="mt-1 text-xs text-gray-500">타인을 존중하는 글 문화를 만들어주세요.</p>
          </div>

          {/* 버튼 */}
          <div className="flex justify-between items-center pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="
                px-4 py-2 text-sm
                border border-gray-400 text-gray-600
                bg-white
                hover:bg-gray-200
              "
            >
              취소
            </button>

            <button
              type="submit"
              className="
                px-6 py-2 text-sm font-semibold
                bg-gray-700 text-white
                hover:bg-gray-800
              "
            >
              등록
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
