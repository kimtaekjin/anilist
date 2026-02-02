import axios from "axios";
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

const Board = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [posts, setPosts] = useState([]);

  // const notices = [
  //   {
  //     id: "공지",
  //     category: "공지",
  //     title: " 게시판 이용 규칙 안내",
  //     author: "운영자",
  //     date: "01-10",
  //     views: 9999,
  //     comments: 32,
  //     recommend: 12,
  //     isNotice: true,
  //   },
  // ];

  // 서버에서 게시글 가져오기
  useEffect(() => {
    const fetchPosts = async () => {
      try {
        const { data } = await axios.get("http://localhost:3000/post");
        setPosts(data);
      } catch (err) {
        console.error(err);
      }
    };

    fetchPosts();
  }, []);

  const createPost = () => {
    if (!user) {
      alert("로그인 후 이용해주세요");
      return;
    }
    navigate("/board/posts");
  };

  return (
    <div className="max-w-6xl mx-auto  p-6 text-sm bg-gray-50">
      <h1 className="text-2xl font-bold mb-4 border-b border-gray-300 pb-2">자유 게시판</h1>

      <div className="border border-gray-300 bg-white shadow-sm">
        <div className="grid grid-cols-12 bg-gray-100 font-semibold text-gray-700 border-b">
          <div className="col-span-1 text-center py-2">번호</div>
          <div className="col-span-2 text-center py-2">말머리</div>
          <div className="col-span-5 py-2">제목</div>
          <div className="col-span-2 text-center py-2">작성자</div>
          <div className="col-span-1 text-center py-2">날짜</div>
          <div className="col-span-1 text-center py-2">조회</div>
        </div>

        {posts.map((post, index) => (
          <div
            key={post._id}
            className={`grid grid-cols-12 items-center cursor-pointer border-b hover:bg-gray-50 ${
              post.isNotice ? "bg-yellow-50 font-semibold" : ""
            }`}
            onClick={() => navigate(`/board/posts/${post._id}`)}
          >
            <div className="col-span-1 text-center py-2 text-gray-600">{post.isNotice ? "공지" : index + 1}</div>
            <div className="col-span-2 text-center py-2 text-blue-600">[{post.category}]</div>
            <div className="col-span-5 py-2 flex items-center gap-2 overflow-hidden">
              <span className="truncate">{post.title}</span>
              {post.comments.length > 0 && <span className="text-orange-500">[{post.comments.length}]</span>}
              {post.recommend >= 5 && (
                <span className="text-red-500 text-xs border border-red-400 px-1 rounded">추천</span>
              )}
            </div>
            <div className="col-span-2 text-center py-2 text-gray-700">{post.author}</div>
            <div className="col-span-1 text-center py-2 text-gray-500">{post.date}</div>
            <div className="col-span-1 text-center py-2 text-gray-500">{post.views}</div>
          </div>
        ))}
      </div>

      <div className="flex justify-between items-center mt-6">
        <div className="flex gap-1 text-sm">
          <button className="px-2 py-1 border hover:bg-gray-100 transition">◀</button>
          <button className="px-3 py-1 border bg-gray-800 text-white">1</button>
          <button className="px-3 py-1 border hover:bg-gray-100 transition">2</button>
          <button className="px-2 py-1 border hover:bg-gray-100 transition">▶</button>
        </div>

        <button
          className="px-5 py-2 bg-gray-800 text-white rounded hover:bg-gray-700 transition-all hover:scale-105"
          onClick={createPost}
        >
          글쓰기
        </button>
      </div>
    </div>
  );
};

export default Board;
