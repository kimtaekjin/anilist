const wordReplacements = [
  { from: "에치", to: "하렘" },
  { from: "고우메", to: "미식" },
  { from: "mys 테리", to: "미스테리" },
  { from: "공상", to: "판타지" },
  { from: "행동", to: "액션" },
  { from: "미결", to: "반전" },
  { from: "신의 조화", to: "초자연" },
  { from: "마호우 쇼조", to: "마법소녀" },
  //장르 분류

  //애니 분류
  { from: "추시의 아이", to: "최애의 아이" },
  { from: "보치 · 자 · 롯쿠!", to: "봇치 더 락!" },
  { from: "장례식 프리렌", to: "장송의 프리렌" },
  { from: ["약점 한사람마다", "약점의 한 사람"], to: "약사의 혼잣말" },
  { from: "촛불 모양", to: "목소리의 형태" },
  { from: "말딸", to: "우마무스메" },
  { from: "카구야 씨는 말하고 싶다", to: "카구야 씨는 고백하고 싶어" },
  { from: "천과 치히로의 은폐", to: "센과 치히로의 행방불명" },
  { from: "루로니 검심", to: "바람의 검심" },
  { from: "첸소만", to: "체인소맨" },
  { from: "리물 테 mpest", to: "리무르 템페스트" },

  { from: ["&#39;", ";", "&lt", "&gt", "&quot;"], to: "" },
];

module.exports = { wordReplacements };
