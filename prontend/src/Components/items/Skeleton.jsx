//포스트 상세페이지
export function PostDetailSkeleton() {
  return (
    <div className="bg-white min-h-screen py-10 animate-pulse">
      <div className="max-w-4xl mx-auto border border-gray-300">
        {/* 헤더 */}
        <div className="px-6 py-4 border-b border-gray-300 bg-gray-200">
          <div className="h-6 w-2/3 bg-gray-300 rounded mb-2"></div>
          <div className="h-4 w-1/3 bg-gray-300 rounded"></div>
        </div>

        {/* 본문 */}
        <div className="p-6 min-h-[30rem] bg-gray-50 space-y-3">
          <div className="h-4 bg-gray-300 rounded w-full"></div>
          <div className="h-4 bg-gray-300 rounded w-11/12"></div>
          <div className="h-4 bg-gray-300 rounded w-10/12"></div>
          <div className="h-4 bg-gray-300 rounded w-9/12"></div>
          <div className="h-4 bg-gray-300 rounded w-8/12"></div>
        </div>

        {/* 댓글 영역 */}
        <div className="px-6 py-4 border-t border-gray-300 bg-white space-y-4">
          <div className="h-4 w-24 bg-gray-300 rounded"></div>

          {[1, 2, 3].map((i) => (
            <div key={i} className="space-y-2">
              <div className="h-3 w-full bg-gray-300 rounded"></div>
              <div className="h-3 w-1/4 bg-gray-300 rounded"></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

//방영중 애니
export const AiringSkeleton = () => (
  <div className="rounded-2xl bg-white shadow-lg overflow-hidden animate-pulse">
    <div className="h-48 bg-gray-200" />
    <div className="p-4 space-y-2">
      <div className="h-5 bg-gray-200 rounded w-3/4" />
      <div className="h-4 bg-gray-200 rounded w-full" />
    </div>
  </div>
);
//장르별 애니
export const GenreSkeleton = () => (
  <div className="bg-white rounded-2xl shadow-lg overflow-hidden animate-pulse">
    {/* 이미지 자리 */}
    <div className="h-52 w-full bg-gray-200 rounded-t-2xl" />

    {/* 텍스트 자리 */}
    <div className="p-4 space-y-2">
      <div className="h-5 w-3/4 bg-gray-300 rounded" />
      <div className="h-4 w-full bg-gray-200 rounded" />
      <div className="h-4 w-5/6 bg-gray-200 rounded" />

      {/* 장르 태그 자리 */}
      <div className="flex flex-wrap gap-1 mt-2">
        <div className="h-5 w-16 bg-gray-200 rounded-full" />
        <div className="h-5 w-12 bg-gray-200 rounded-full" />
      </div>

      {/* 날짜 + 스튜디오 자리 */}
      <div className="flex justify-between mt-2 text-sm text-gray-400">
        <div className="h-4 w-12 bg-gray-200 rounded" />
        <div className="h-4 w-16 bg-gray-200 rounded" />
      </div>
    </div>
  </div>
);

//방영예정 애니
export const UpcommingSkeleton = () => (
  <div className="rounded-3xl bg-white shadow-xl overflow-hidden animate-pulse">
    <div className="aspect-[16/9] bg-gray-200" />
    <div className="p-6 space-y-2">
      <div className="h-5 bg-gray-200 rounded w-3/4" />
      <div className="h-4 bg-gray-200 rounded w-full" />
      <div className="h-4 bg-gray-200 rounded w-5/6" />
      <div className="h-3 bg-gray-200 rounded w-1/3 mt-2" />
    </div>
  </div>
);

//애니메이션 상세페이지
export const AnimeDetailSkeleton = () => {
  return (
    <div className="container mx-auto px-4 py-10 animate-pulse">
      {/* 배너 */}
      <div className="w-full h-72 bg-gray-200 rounded-2xl mb-6" />

      {/* 상단 정보 */}
      <div className="flex flex-col md:flex-row gap-6 mb-6">
        {/* 커버 이미지 */}
        <div className="w-56 h-80 bg-gray-200 rounded-xl shadow-lg" />

        {/* 텍스트 영역 */}
        <div className="flex-1 space-y-4">
          {/* 제목 */}
          <div className="h-8 bg-gray-200 rounded w-3/4" />

          {/* 시즌 / 상태 */}
          <div className="h-4 bg-gray-200 rounded w-1/2" />

          {/* 평점 */}
          <div className="h-5 bg-gray-200 rounded w-32" />

          {/* 장르 */}
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="px-4 py-2 bg-gray-200 rounded-full w-20 h-6" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
