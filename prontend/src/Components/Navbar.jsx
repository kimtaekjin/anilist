import React from "react";

const Navbar = () => {
  return (
    <>
      <nav className="fixed top-0 left-0 w-full bg-white shadow-lg z-50">
        <div className="w-full flex justify-between items-center py-4 px-6">
          <p className="text-2xl font-bold text-gray-800">AniWiki</p>
          <div>
            <button className="px-4 py-2 rounded  hover:text-gray-500 transition">방영중</button>
            <button className="px-4 py-2 rounded  hover:text-gray-500 transition">예정작</button>
            <button className="px-4 py-2 rounded  hover:text-gray-500 transition">장르</button>
            <button className="px-4 py-2 rounded  hover:text-gray-500 transition">게시판</button>
          </div>
          <div className="flex space-x-4">
            <button className="px-4 py-2 rounded hover:bg-gray-200 transition">Login</button>
            <button className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition">Sign Up</button>
          </div>
        </div>
      </nav>
    </>
  );
};

export default Navbar;
