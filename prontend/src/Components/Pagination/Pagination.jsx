import React from "react";

const Pagination = ({ currentPage, totalItems, itemsPerPage, maxPageButtons = 5, onPageChange }) => {
  const totalPages = Math.ceil(totalItems / itemsPerPage);

  if (totalPages <= 1) return null;

  const getPageNumbers = () => {
    const pages = [];
    let start = Math.max(currentPage - 2, 1);
    let end = Math.min(start + maxPageButtons - 1, totalPages);

    if (start > 1) {
      pages.push(1);
      if (start > 2) pages.push("...");
    }

    for (let i = start; i <= end; i++) pages.push(i);

    if (end < totalPages) {
      if (end < totalPages - 1) pages.push("...");
      pages.push(totalPages);
    }

    return pages;
  };

  return (
    <div className="flex justify-center mt-10 gap-2 flex-wrap">
      {/* 이전 버튼 */}
      <button
        onClick={() => currentPage > 1 && onPageChange(currentPage - 2)}
        className={`px-3 py-1 rounded-2xl  hover:bg-gray-100 transition ${
          currentPage === 1 ? "opacity-50 cursor-not-allowed" : ""
        }`}
      >
        ◀ 이전
      </button>

      {/* 페이지 번호 */}
      {getPageNumbers().map((p, i) =>
        p === "..." ? (
          <span key={i} className="px-2 text-gray-400">
            …
          </span>
        ) : (
          <button
            key={p}
            onClick={() => onPageChange(p)}
            className={`px-3 py-1 rounded-2xl ${
              currentPage === p ? "bg-red-600 text-white" : "bg-gray-200 hover:bg-gray-300"
            }`}
          >
            {p}
          </button>
        ),
      )}

      {/* 다음 버튼 */}
      <button
        onClick={() => currentPage < totalPages && onPageChange(currentPage + 2)}
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
