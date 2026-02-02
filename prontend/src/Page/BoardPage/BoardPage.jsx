import axios from "axios";
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import Pagination from "../../Components/Pagination/Pagination";

const Board = () => {
  const navigate = useNavigate();
  const API = process.env.NEXT_PUBLIC_API_URL;
  const { user } = useAuth();

  const [posts, setPosts] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);

  const itemsPerPage = 15;

  useEffect(() => {
    const fetchPosts = async () => {
      setCurrentPage(1);
      try {
        const { data } = await axios.get(`${API}/post`);
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

  const indexOfLast = currentPage * itemsPerPage;
  const indexOfFirst = indexOfLast - itemsPerPage;
  const currentPosts = posts.slice(indexOfFirst, indexOfLast);

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6 text-sm bg-gray-50">
      <h1 className="text-2xl font-bold mb-4 border-b border-gray-300 pb-2">자유 게시판</h1>

      <div className="border border-gray-300 bg-white shadow-sm">
        <div className="grid grid-cols-12 bg-gray-100 font-semibold text-gray-700 border-b text-xs sm:text-sm">
          <div className="col-span-1 text-center py-2">번호</div>
          <div className="col-span-2 text-center py-2 hidden sm:block">말머리</div>
          <div className="col-span-5 py-2">제목</div>
          <div className="col-span-2 text-center py-2 hidden sm:block">작성자</div>
          <div className="col-span-1 text-center py-2 hidden md:block">날짜</div>
          <div className="col-span-1 text-center py-2 hidden lg:block">조회</div>
        </div>

        {currentPosts.map((post, index) => {
          const displayNumber = post.isNotice ? "공지" : posts.length - ((currentPage - 1) * itemsPerPage + index);

          return (
            <div
              key={post._id}
              className={`grid grid-cols-12 items-center cursor-pointer border-b hover:bg-gray-50 ${
                post.isNotice ? "bg-yellow-50 font-semibold" : ""
              }`}
              onClick={() => navigate(`/board/posts/${post._id}`)}
            >
              <div className="col-span-1 text-center py-2 text-gray-600">{displayNumber}</div>
              <div className="col-span-2 text-center py-2 text-blue-600 hidden sm:block">[{post.category}]</div>
              <div className="col-span-5 py-2 flex items-center gap-2 overflow-hidden">
                <span className="truncate">{post.title}</span>
                {post.comments.length > 0 && <span className="text-orange-500">[{post.comments.length}]</span>}
                {post.recommend >= 5 && (
                  <span className="text-red-500 text-xs border border-red-400 px-1 rounded">추천</span>
                )}
              </div>
              <div className="col-span-2 text-center py-2 text-gray-700 hidden sm:block">{post.author}</div>
              <div className="col-span-1 text-center py-2 text-gray-500 hidden md:block">{post.date}</div>
              <div className="col-span-1 text-center py-2 text-gray-500 hidden lg:block">{post.views}</div>
            </div>
          );
        })}
      </div>

      <div className="flex flex-col sm:flex-row justify-between items-center mt-6 gap-4">
        <Pagination
          currentPage={currentPage}
          totalItems={posts.length}
          itemsPerPage={itemsPerPage}
          onPageChange={setCurrentPage}
        />

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
