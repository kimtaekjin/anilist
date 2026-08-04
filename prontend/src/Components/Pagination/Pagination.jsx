import React from "react";

const Pagination = ({ currentPage, totalItems, itemsPerPage, maxPageButtons = 6, onPageChange }) => {
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const groupStart = Math.floor((currentPage - 1) / maxPageButtons) * maxPageButtons + 1;
  const groupEnd = Math.min(groupStart + maxPageButtons - 1, totalPages);

  if (totalPages <= 1) return null;

  const getPageNumbers = () => {
    const pages = [];
    for (let i = groupStart; i <= groupEnd; i++) pages.push(i);
    return pages;
  };

  const changePage = (page) => {
    window.scrollTo({ top: 0, behavior: "smooth" });
    onPageChange(page);
  };

  const buttonBase =
    "rounded-md border border-stone-100/10 px-3 py-1.5 text-sm font-semibold transition duration-200 focus:outline-none focus:ring-4 focus:ring-amber-500/20";

  return (
    <div className="mt-10 flex flex-wrap justify-center gap-2">
      <button
        onClick={() => groupStart > 1 && changePage(Math.max(groupStart - 1, 1))}
        className={`${buttonBase} ${
          groupStart === 1
            ? "cursor-not-allowed opacity-40"
            : "bg-[#181816] text-stone-300 hover:-translate-y-0.5 hover:border-amber-500 hover:text-amber-300"
        }`}
      >
        이전
      </button>

      {getPageNumbers().map((page) => (
        <button
          key={page}
          onClick={() => changePage(page)}
          className={`${buttonBase} ${
            currentPage === page
              ? "border-red-500 bg-red-600 text-white"
              : "bg-[#181816] text-stone-300 hover:-translate-y-0.5 hover:border-amber-500 hover:text-amber-300"
          }`}
        >
          {page}
        </button>
      ))}

      <button
        onClick={() => groupEnd < totalPages && changePage(Math.min(groupEnd + 1, totalPages))}
        className={`${buttonBase} ${
          groupEnd === totalPages
            ? "cursor-not-allowed opacity-40"
            : "bg-[#181816] text-stone-300 hover:-translate-y-0.5 hover:border-amber-500 hover:text-amber-300"
        }`}
      >
        다음
      </button>
    </div>
  );
};

export default Pagination;
