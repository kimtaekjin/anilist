import axios from "axios";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PenLine } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import Pagination from "../../Components/Pagination/Pagination";

const TEXT = {
  loginRequired: "\uB85C\uADF8\uC778\uC774 \uD544\uC694\uD569\uB2C8\uB2E4.",
  title: "\uC790\uC720 \uAC8C\uC2DC\uD310",
  write: "\uAE00\uC4F0\uAE30",
  number: "\uBC88\uD638",
  category: "\uB9D0\uBA38\uB9AC",
  postTitle: "\uC81C\uBAA9",
  author: "\uC791\uC131\uC790",
  date: "\uB0A0\uC9DC",
  views: "\uC870\uD68C",
  empty: "\uB4F1\uB85D\uB41C \uAC8C\uC2DC\uAE00\uC774 \uC5C6\uC2B5\uB2C8\uB2E4.",
  notice: "\uACF5\uC9C0",
  recommend: "\uCD94\uCC9C",
};

const Board = () => {
  const navigate = useNavigate();
  const API_URL = process.env.REACT_APP_CLIENT_URL;
  const { user } = useAuth();

  const [posts, setPosts] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  const itemsPerPage = 15;

  useEffect(() => {
    const fetchPosts = async () => {
      try {
        const { data } = await axios.get(`${API_URL}/post`, {
          params: {
            page: currentPage,
            limit: itemsPerPage,
          },
        });
        const nextPosts = Array.isArray(data) ? data : data.items || [];
        setPosts(nextPosts);
        setTotalItems(Array.isArray(data) ? data.length : data.total || nextPosts.length);
      } catch (err) {
        console.error(err);
      }
    };

    fetchPosts();
  }, [API_URL, currentPage]);

  const createPost = () => {
    if (!user) {
      alert(TEXT.loginRequired);
      return;
    }
    navigate("/board/posts");
  };

  return (
    <section className="mx-auto min-h-screen max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-amber-400">Community</p>
          <h1 className="mt-2 text-3xl font-bold text-stone-50">{TEXT.title}</h1>
        </div>

        <button
          className="inline-flex items-center justify-center gap-2 rounded-md bg-red-600 px-4 py-2 text-sm font-bold text-white transition duration-200 hover:-translate-y-0.5 hover:bg-red-500 focus:outline-none focus:ring-4 focus:ring-red-500/20"
          onClick={createPost}
          type="button"
        >
          <PenLine size={16} />
          {TEXT.write}
        </button>
      </div>

      <div className="overflow-hidden rounded-lg border border-stone-100/10 bg-[#181816] shadow-xl shadow-black/25">
        <div className="grid grid-cols-12 border-b border-stone-100/10 bg-stone-100/5 px-2 text-xs font-bold uppercase tracking-wide text-stone-400 sm:text-sm">
          <div className="col-span-1 py-3 text-center">{TEXT.number}</div>
          <div className="col-span-2 hidden py-3 text-center sm:block">{TEXT.category}</div>
          <div className="col-span-7 py-3 sm:col-span-5">{TEXT.postTitle}</div>
          <div className="col-span-2 hidden py-3 text-center sm:block">{TEXT.author}</div>
          <div className="col-span-1 hidden py-3 text-center md:block">{TEXT.date}</div>
          <div className="col-span-1 hidden py-3 text-center lg:block">{TEXT.views}</div>
        </div>

        {posts.length === 0 && <div className="py-16 text-center text-sm text-stone-400">{TEXT.empty}</div>}

        {posts.map((post, index) => {
          const commentCount = post.commentCount ?? post.comments?.length ?? 0;
          const displayNumber = post.isNotice ? TEXT.notice : totalItems - ((currentPage - 1) * itemsPerPage + index);

          return (
            <button
              key={post._id}
              type="button"
              className={`grid w-full grid-cols-12 items-center border-b border-stone-100/10 px-2 text-left text-sm transition duration-200 last:border-b-0 hover:bg-stone-100/5 ${
                post.isNotice ? "bg-amber-500/10 font-semibold" : ""
              }`}
              onClick={() => navigate(`/board/posts/${post._id}`)}
            >
              <div className="col-span-1 py-3 text-center text-stone-500">{displayNumber}</div>
              <div className="col-span-2 hidden py-3 text-center text-amber-300 sm:block">[{post.category}]</div>
              <div className="col-span-7 flex min-w-0 items-center gap-2 py-3 text-stone-100 sm:col-span-5">
                <span className="truncate">{post.title}</span>
                {commentCount > 0 && (
                  <span className="shrink-0 text-xs font-bold text-cyan-200">[{commentCount}]</span>
                )}
                {post.recommend >= 5 && (
                  <span className="shrink-0 rounded border border-red-400/50 px-1 text-xs text-red-200">
                    {TEXT.recommend}
                  </span>
                )}
              </div>
              <div className="col-span-2 hidden py-3 text-center text-stone-300 sm:block">{post.author}</div>
              <div className="col-span-1 hidden py-3 text-center text-stone-500 md:block">{post.date}</div>
              <div className="col-span-1 hidden py-3 text-center text-stone-500 lg:block">{post.views}</div>
            </button>
          );
        })}
      </div>

      <Pagination
        currentPage={currentPage}
        totalItems={totalItems}
        itemsPerPage={itemsPerPage}
        onPageChange={setCurrentPage}
      />
    </section>
  );
};

export default Board;
