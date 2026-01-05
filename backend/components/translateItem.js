function romajiToKatakana(text) {
  const specialPatterns = [{ regex: /(\d+)(st|nd|rd|th)/gi, replace: (_, num) => `第${num}シーズン` }];

  // 1️⃣ 특수 패턴 먼저 처리
  for (const pattern of specialPatterns) {
    text = text.replace(pattern.regex, pattern.replace);
  }

  // 2️⃣ 영어 단어 전체를 한 번에 소문자로 변환 후 Katakana
  return text.replace(/[a-zA-Z]+/g, (match) => {
    return wanakana.toKatakana(match.toLowerCase());
  });
}

module.exports = { romajiToKatakana };
