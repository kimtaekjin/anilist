import React from "react";

const Footer = () => {
  return (
    <footer className="bg-gray-900 text-gray-300 py-8 mt-10">
      <div className="max-w-6xl mx-auto px-6">
        <div className="flex flex-col md:flex-row items-center justify-center md:justify-between gap-6">
          {/* 로고/사이트 이름 */}
          <p className="text-xl font-bold">AniWiki</p>

          {/* 링크 */}
          <div className="flex space-x-6">
            <a href="/" className="hover:text-white transition-colors duration-200">
              Home
            </a>
            <a href="/" className="hover:text-white transition-colors duration-200">
              About
            </a>
            <a href="/" className="hover:text-white transition-colors duration-200">
              Contact
            </a>
            <a href="/" className="hover:text-white transition-colors duration-200">
              Privacy
            </a>
          </div>

          {/* 저작권 */}
          <p className="text-sm text-gray-400 text-center">&copy; 2025 AniWiki. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
