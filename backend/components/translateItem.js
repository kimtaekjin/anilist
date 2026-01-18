const GOOGLE_KEY = process.env.GOOGLETRANSLATION;
const fetch = require("node-fetch");
const wanakana = require("wanakana");
const { wordReplacements } = require("./wordReplace");

// ----------------------
// Romaji → Katakana 변환 (숫자+영어 혼합 안전 처리)
// ----------------------

function romajiToKatakana(text) {
  if (!text) return "";

  // 특수 패턴 처리 (예: 1st, 2nd → 第1シーズン)
  const specialPatterns = [{ regex: /(\d+)(st|nd|rd|th)/gi, replace: (_, num) => `第${num}シーズン` }];

  for (const pattern of specialPatterns) {
    text = text.replace(pattern.regex, pattern.replace);
  }

  // 영어 단어를 숫자와 분리해서 Katakana 변환
  return text.replace(/[a-zA-Z]+/g, (match) => wanakana.toKatakana(match.toLowerCase()));
}

// ----------------------
// Google Translate 호출
// ----------------------
async function translate(text, source, target) {
  const bodyPayload = {
    q: text,
    target,
  };
  if (source && source !== "auto") bodyPayload.source = source;

  const response = await fetch(`https://translation.googleapis.com/language/translate/v2?key=${GOOGLE_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(bodyPayload),
  });

  const data = await response.json();
  return data.data?.translations?.[0]?.translatedText || text;
}

// ----------------------
// Romaji 판단
// ----------------------
// function isRomaji(text) {
//   const romajiPattern = /(sh|ch|ts|ky|ry|ny|hy|my|py|by|gy|j|ou|uu|aa|ii|ee|oo)/i;
//   const onlyLatin = /^[a-zA-Z0-9\s\-:]+$/.test(text);
//   return onlyLatin && romajiPattern.test(text);
// }

function isRomaji(text) {
  if (!text) return false;

  // 알파벳 + 공백만
  if (!/^[A-Za-z\s]+$/.test(text)) return false;

  const words = text.trim().split(/\s+/);

  // 이름은 보통 2단어 이상
  if (words.length < 2 || words.length > 3) return false;

  // 각 단어가 대문자로 시작
  if (!words.every((w) => /^[A-Z][a-z]+$/.test(w))) return false;

  // 너무 영어스러운 단어 제외
  const englishBlacklist = ["The", "Of", "And"];
  if (words.some((w) => englishBlacklist.includes(w))) return false;

  return true;
}

function replaceMistranslation(translatedText) {
  if (!translatedText) return "";

  let fixed = translatedText.trim();

  for (const { from, to } of wordReplacements) {
    // 단어 경계 제거, g = 모두 교체, i = 대소문자 무시
    const regex = new RegExp(from, "gi");
    fixed = fixed.replace(regex, to);
  }
  return fixed;
}

module.exports = { romajiToKatakana, translate, isRomaji, replaceMistranslation };
