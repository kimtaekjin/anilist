import { translateItem } from "./translateItem.js";

export const genreKoMap = {
  Action: "액션",
  Adventure: "모험",
  Comedy: "코미디",
  Drama: "드라마",
  Fantasy: "판타지",
  Horror: "호러",
  Mystery: "미스터리",
  Romance: "로맨스",
  "Sci-Fi": "SF",
  "Slice of Life": "일상",
  Sports: "스포츠",
  Supernatural: "초자연",
  Suspense: "서스펜스",
  Ecchi: "에치",
  Gourmet: "요리",
  "Award Winning": "수상작",
  "Avant Garde": "아방가르드",
};

export async function localizeGenre(genre) {
  return genreKoMap[genre] || translateItem(genre).catch(() => genre);
}
