import React from "react";
import { Link } from "react-router-dom";

const Navbar = () => {
  const menuItems = [
    { path: "/Airing", key: "방영중" },
    { path: "/Genre", key: "장르 · 분기" },
    { path: "/Upcoming", key: "예정작" },
    { path: "/board", key: "게시판" },
  ];

  const MenuItem = ({ path, label, onClick }) => (
    <li>
      <Link to={path} className="hover:text-gray-500 transition duration-300" onClick={onClick}>
        {label}
      </Link>
    </li>
  );

  return (
    <>
      <nav className="fixed top-0 left-0 w-full bg-[rgb(220,225,235)] shadow-lg z-50">
        <div className="w-full flex justify-between items-center py-4 px-6">
          <Link to="/" className="text-2xl font-bold text-gray-800 border-2 border-black px-2">
            AniWiki
          </Link>

          <div className="flex justify-center">
            <ul className="flex gap-8 text-lg">
              {menuItems.map((item) => (
                <MenuItem key={item.path} path={item.path} label={item.key} />
              ))}
            </ul>
          </div>
          <div className="flex space-x-4">
            <Link to="/login">
              <button className="px-4 py-2 rounded hover:text-gray-500 transition">Login</button>
            </Link>
            <Link to="/singUp">
              <button className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition">Sign Up</button>
            </Link>
          </div>
        </div>
      </nav>
    </>
  );
};

export default Navbar;
