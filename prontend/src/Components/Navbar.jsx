import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import axios from "axios";

const Navbar = () => {
  const { isLogin, logout, token, user } = useAuth();
  const navigate = useNavigate();

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

  const handleLogout = async (e) => {
    try {
      e.preventDefault();
      const resposne = await axios.post("http://localhost:3000/user/logout", {}, { withCredentials: true });

      if (resposne.data) {
        logout();
        alert(resposne.data.message);
        navigate("/");
      }
    } catch (error) {
      console.log(error);
    }
  };

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
          {isLogin ? (
            <div className="flex space-x-2">
              <div className="px-4 py-2">
                <p>{user?.userName}님 환영합니다.</p>
              </div>
              <div>
                <button
                  className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition"
                  onClick={handleLogout}
                >
                  로그아웃
                </button>
              </div>
            </div>
          ) : (
            <div className="flex space-x-4">
              <Link to="/login">
                <button className="px-4 py-2 rounded hover:text-gray-500 transition">로그인</button>
              </Link>
              <Link to="/singUp">
                <button className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition">
                  회원가입
                </button>
              </Link>
            </div>
          )}
        </div>
      </nav>
    </>
  );
};

export default Navbar;
