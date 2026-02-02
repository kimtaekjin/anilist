import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useState } from "react";
import { HiMenu, HiX } from "react-icons/hi";

const Navbar = () => {
  const { isLogin, logout, user } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const menuItems = [
    { path: "/Airing", key: "방영중" },
    { path: "/Genre", key: "장르 · 분기" },
    { path: "/Upcoming", key: "예정작" },
    { path: "/board", key: "게시판" },
  ];

  const MenuItem = ({ path, label, onClick }) => (
    <li>
      <Link to={path} className="block py-2 px-4 hover:text-gray-500 transition" onClick={onClick}>
        {label}
      </Link>
    </li>
  );

  const handleLogout = async (e) => {
    e.preventDefault();
    try {
      const response = await logout();
      if (response) {
        alert(response.message || "로그아웃 되었습니다.");
        navigate("/");
      }
    } catch (error) {
      console.error(error);
      alert("로그아웃 실패");
    }
  };

  return (
    <nav className="fixed top-0 left-0 w-full bg-[rgb(220,225,235)] shadow-lg z-50">
      <div className="max-w-6xl mx-auto flex justify-between items-center py-4 px-6">
        <Link to="/" className="text-2xl font-bold text-gray-800 border-2 border-black px-2">
          AniWiki
        </Link>

        <ul className="hidden md:flex gap-5 text-lg">
          {menuItems.map((item) => (
            <MenuItem key={item.key} path={item.path} label={item.key} />
          ))}
        </ul>

        {/* 모바일 햄버거 버튼 */}
        <button className="md:hidden text-2xl" onClick={() => setMenuOpen(!menuOpen)}>
          {menuOpen ? <HiX /> : <HiMenu />}
        </button>

        <div className="hidden md:flex items-center space-x-2">
          {isLogin ? (
            <>
              <p>{user.userName}님 환영합니다.</p>
              <button
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition"
                onClick={handleLogout}
              >
                로그아웃
              </button>
            </>
          ) : (
            <>
              <Link to="/login">
                <button className="px-4 py-2 border border-gray-500 rounded hover:text-gray-500 transition">
                  로그인
                </button>
              </Link>
              <Link to="/singUp">
                <button className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition">
                  회원가입
                </button>
              </Link>
            </>
          )}
        </div>
      </div>

      {menuOpen && (
        <div className="md:hidden bg-[rgb(220,225,235)] border-t border-gray-300">
          <ul className="flex flex-col">
            {menuItems.map((item) => (
              <MenuItem key={item.path} path={item.path} label={item.key} onClick={() => setMenuOpen(false)} />
            ))}
            <div className="flex flex-col p-4 space-y-2">
              {isLogin ? (
                <>
                  <p>{user.userName}님 환영합니다.</p>
                  <button
                    className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition"
                    onClick={handleLogout}
                  >
                    로그아웃
                  </button>
                </>
              ) : (
                <div className="flex  space-x-2">
                  <Link to="/login">
                    <button className="px-4 py-2 border border-gray-500 rounded hover:text-gray-500 transition">
                      로그인
                    </button>
                  </Link>
                  <Link to="/singUp">
                    <button className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition">
                      회원가입
                    </button>
                  </Link>
                </div>
              )}
            </div>
          </ul>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
