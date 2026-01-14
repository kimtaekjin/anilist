import React from "react";
import { StarIcon as StarSolid } from "@heroicons/react/24/solid";
import { StarIcon as StarOutline } from "@heroicons/react/24/outline";

const StarRating = ({ score = 0, maxStars = 5, size = 16, showText = true }) => {
  const scoreOutOfFive = score / 20;

  const fullStars = Math.floor(scoreOutOfFive);
  const hasHalfStar = scoreOutOfFive - fullStars >= 0.5;
  const emptyStars = maxStars - fullStars - (hasHalfStar ? 1 : 0);

  return (
    <div className="flex items-center gap-1">
      {/* 꽉 찬 별 */}
      {Array.from({ length: fullStars }).map((_, i) => (
        <StarSolid key={`full-${i}`} className="text-yellow-400" style={{ width: size, height: size }} />
      ))}

      {/* 반 별 */}
      {hasHalfStar && (
        <div className="relative" style={{ width: size, height: size }}>
          <StarOutline className="absolute text-gray-300" style={{ width: size, height: size }} />
          <StarSolid
            className="absolute text-yellow-400"
            style={{
              width: size,
              height: size,
              clipPath: "inset(0 50% 0 0)", //반만 채우게
            }}
          />
        </div>
      )}

      {/* 빈 별 */}
      {Array.from({ length: emptyStars }).map((_, i) => (
        <StarOutline key={`empty-${i}`} className="text-gray-300" style={{ width: size, height: size }} />
      ))}

      {showText && (
        <span className="ml-2 text-sm text-gray-500">
          {scoreOutOfFive.toFixed(1)} / {maxStars}
        </span>
      )}
    </div>
  );
};

export default StarRating;
