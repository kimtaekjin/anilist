import React from "react";

const Pagination = ({ currentPage, totalItems, itemsPerPage, maxPageButtons = 6, onPageChange }) => {
  const totalPages = Math.ceil(totalItems / itemsPerPage);

  if (totalPages <= 1) return null;

  const getPageNumbers = () => {
    const pages = [];
    let start = Math.max(currentPage, 1);
    let end = Math.min(start + maxPageButtons - 1, totalPages);

    for (let i = start; i <= end; i++) pages.push(i);
    return pages;
  };

  const changePage = (page) => {
    window.scrollTo({ top: 0, behavior: "smooth" });
    onPageChange(page);
  };

  return (
    <div className="flex justify-center mt-10 gap-2 flex-wrap">
      {/* 이전 버튼 */}
      <button
        onClick={() => currentPage > 1 && changePage(Math.max(currentPage - 6, 1))}
        className={`px-3 py-1 rounded-2xl hover:bg-gray-100 transition ${
          currentPage === 1 ? "opacity-50 cursor-not-allowed" : ""
        }`}
      >
        ◀ 이전
      </button>

      {/* 페이지 번호 */}
      {getPageNumbers().map((p, _) => (
        <button
          key={p}
          onClick={() => changePage(p)}
          className={`px-3 py-1 rounded-2xl text-sm ${
            currentPage === p ? "bg-red-600 text-white" : "hover:bg-gray-300"
          }`}
        >
          {p}
        </button>
      ))}

      {/* 다음 버튼 */}
      <button
        onClick={() => currentPage < totalPages && changePage(Math.min(currentPage + 6, totalPages))}
        className={`px-3 py-1 rounded-2xl hover:bg-gray-100 transition ${
          currentPage === totalPages ? "opacity-50 cursor-not-allowed" : ""
        }`}
      >
        다음 ▶
      </button>
    </div>
  );
};

export default Pagination;
