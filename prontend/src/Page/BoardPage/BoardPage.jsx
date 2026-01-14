import React from "react";

const Board = () => {
  const notices = [
    {
      id: "공지",
      category: "공지",
      title: "인벤 게시판 이용 규칙 안내",
      author: "INVEN",
      date: "01-10",
      views: 9999,
      comments: 32,
      recommend: 12,
      isNotice: true,
    },
  ];

  const posts = [
    {
      id: 1,
      category: "자유",
      title: "이번 패치 밸런스 솔직 후기",
      author: "검성유저",
      date: "01-15",
      views: 812,
      comments: 18,
      recommend: 7,
    },
    {
      id: 2,
      category: "질문",
      title: "뉴비 직업 뭐가 제일 무난함?",
      author: "뉴비123",
      date: "01-15",
      views: 402,
      comments: 9,
      recommend: 2,
    },
    {
      id: 3,
      category: "자유",
      title: "애니메이션 연출 이 정도면 괜찮지 않음?",
      author: "프론트장인",
      date: "01-14",
      views: 231,
      comments: 4,
      recommend: 1,
    },
  ];

  const allPosts = [...notices, ...posts];

  return (
    <div className="max-w-6xl mx-auto p-6 text-sm bg-gray-50">
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

        {allPosts.map((post) => (
          <div
            key={post.id}
            className={`grid grid-cols-12 items-center border-b hover:bg-gray-50 ${
              post.isNotice ? "bg-yellow-50 font-semibold" : ""
            }`}
          >
            <div className="col-span-1 text-center py-2 text-gray-600">{post.isNotice ? "공지" : post.id}</div>
            <div className="col-span-2 text-center py-2 text-blue-600">[{post.category}]</div>
            <div className="col-span-5 py-2 flex items-center gap-2 overflow-hidden">
              <span className="truncate">{post.title}</span>
              {post.comments > 0 && <span className="text-orange-500">[{post.comments}]</span>}
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

        <button className="px-5 py-2 bg-gray-800 text-white rounded hover:bg-gray-700 transition-all hover:scale-105">
          글쓰기
        </button>
      </div>
    </div>
  );
};

export default Board;
