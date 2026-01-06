import React, { useState } from "react";

function Board() {
  const [posts, setPosts] = useState([
    { title: "첫 번째 게시글", author: "관리자", date: "2026-01-06", views: 12 },
    { title: "추천 애니 알려주세요", author: "유저1", date: "2026-01-05", views: 34 },
  ]);

  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ title: "", author: "", content: "" });

  const handleSubmit = (e) => {
    e.preventDefault();
    const newPost = {
      title: formData.title,
      author: formData.author,
      content: formData.content,
      date: new Date().toLocaleDateString(),
      views: 0,
    };
    setPosts([newPost, ...posts]);
    setFormData({ title: "", author: "", content: "" });
    setShowForm(false);
  };

  return (
    <section className="space-y-6 min-h-96 mt-9">
      {/* 게시판 헤더 */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-semibold text-gray-800">게시판</h2>
        <button
          className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-red-600 transition"
          onClick={() => setShowForm(!showForm)}
        >
          새 글 작성
        </button>
      </div>

      {/* 새 글 작성 폼 */}
      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white shadow-md rounded p-6 space-y-4">
          <input
            type="text"
            placeholder="제목"
            className="w-full border-gray-300 border rounded p-2 focus:outline-none focus:ring-2 focus:ring-red-500"
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            required
          />
          <input
            type="text"
            placeholder="작성자"
            className="w-full border-gray-300 border rounded p-2 focus:outline-none focus:ring-2 focus:ring-red-500"
            value={formData.author}
            onChange={(e) => setFormData({ ...formData, author: e.target.value })}
            required
          />
          <textarea
            placeholder="내용"
            rows={4}
            className="w-full border-gray-300 border rounded p-2 focus:outline-none focus:ring-2 focus:ring-red-500"
            value={formData.content}
            onChange={(e) => setFormData({ ...formData, content: e.target.value })}
            required
          />
          <div className="flex justify-end space-x-2">
            <button
              type="button"
              className="px-4 py-2 border rounded hover:bg-gray-100 transition"
              onClick={() => setShowForm(false)}
            >
              취소
            </button>
            <button type="submit" className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600 transition">
              작성
            </button>
          </div>
        </form>
      )}

      {/* 게시글 리스트 */}
      <div className="grid md:grid-cols-2 gap-6">
        {posts.map((post, index) => (
          <div key={index} className="bg-white shadow rounded p-4 hover:shadow-md transition">
            <h3 className="text-lg font-semibold text-gray-800">{post.title}</h3>
            <p className="text-gray-600 text-sm mt-1">
              작성자: {post.author} | 날짜: {post.date}
            </p>
            <p className="text-gray-500 text-sm mt-2">조회수: {post.views}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

export default Board;
