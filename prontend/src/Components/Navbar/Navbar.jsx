import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useState } from "react";
import { HiMenu, HiX } from "react-icons/hi";

const menuItems = [
  { path: "/Airing", label: "방영중" },
  { path: "/Genre", label: "장르/분기" },
  { path: "/Upcoming", label: "예정작" },
  { path: "/board", label: "게시판" },
];

const Navbar = () => {
  const { isLogin, logout, user } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const MenuItem = ({ path, label, onClick }) => (
    <li>
      <Link
        to={path}
        className="block rounded-md px-3 py-2 text-sm font-semibold text-stone-300 transition duration-200 hover:bg-stone-100/5 hover:text-amber-300"
        onClick={onClick}
      >
        {label}
      </Link>
    </li>
  );

  const handleLogout = async (e) => {
    e.preventDefault();
    try {
      const response = await logout();
      if (response) {
        alert(response.message || "로그아웃되었습니다.");
        setMenuOpen(false);
        navigate("/");
      }
    } catch (error) {
      console.error(error);
      alert("로그아웃에 실패했습니다.");
    }
  };

  return (
    <nav className="fixed left-0 top-0 z-50 w-full border-b border-stone-100/10 bg-[#12110f]/92 shadow-2xl shadow-black/25 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link
          to="/"
          className="rounded-md border border-amber-400/40 px-2 py-1 text-2xl font-black tracking-normal text-stone-50 transition duration-200 hover:border-amber-300 hover:text-amber-200"
        >
          AniWiki
        </Link>

        <ul className="hidden items-center gap-2 md:flex">
          {menuItems.map((item) => (
            <MenuItem key={item.path} path={item.path} label={item.label} />
          ))}
        </ul>

        <button
          className="rounded-md p-2 text-2xl text-stone-100 transition hover:bg-stone-100/10 md:hidden"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="메뉴 열기"
        >
          {menuOpen ? <HiX /> : <HiMenu />}
        </button>

        <div className="hidden items-center gap-2 md:flex">
          {isLogin ? (
            <>
              <p className="max-w-40 truncate text-sm font-semibold text-stone-300">{user.userName}님</p>
              <button
                className="rounded-md bg-red-600 px-4 py-2 text-sm font-bold text-white transition duration-200 hover:bg-red-500"
                onClick={handleLogout}
              >
                로그아웃
              </button>
            </>
          ) : (
            <>
              <Link to="/user/login">
                <button className="rounded-md border border-stone-100/20 px-4 py-2 text-sm font-bold text-stone-200 transition duration-200 hover:border-amber-400 hover:text-amber-300">
                  로그인
                </button>
              </Link>
              <Link to="/user/singUp">
                <button className="rounded-md bg-red-600 px-4 py-2 text-sm font-bold text-white transition duration-200 hover:bg-red-500">
                  회원가입
                </button>
              </Link>
            </>
          )}
        </div>
      </div>

      {menuOpen && (
        <div className="border-t border-stone-100/10 bg-[#12110f] md:hidden">
          <ul className="flex flex-col px-4 py-3">
            {menuItems.map((item) => (
              <MenuItem key={item.path} path={item.path} label={item.label} onClick={() => setMenuOpen(false)} />
            ))}
            <div className="flex flex-col gap-2 py-3">
              {isLogin ? (
                <>
                  <p className="px-3 text-sm font-semibold text-stone-300">{user.userName}님</p>
                  <button
                    className="rounded-md bg-red-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-red-500"
                    onClick={handleLogout}
                  >
                    로그아웃
                  </button>
                </>
              ) : (
                <div className="flex gap-2">
                  <button
                    className="rounded-md border border-stone-100/20 px-4 py-2 text-sm font-bold text-stone-200 transition hover:border-amber-400 hover:text-amber-300"
                    onClick={() => {
                      setMenuOpen(false);
                      navigate("/user/login");
                    }}
                  >
                    로그인
                  </button>

                  <button
                    className="rounded-md bg-red-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-red-500"
                    onClick={() => {
                      setMenuOpen(false);
                      navigate("/user/singUp");
                    }}
                  >
                    회원가입
                  </button>
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
