const GOOGLE_KEY = process.env.GOOGLETRANSLATION;
const fetch = require("node-fetch");
const wanakana = require("wanakana");
const { wordReplacements } = require("./wordReplace");

// ----------------------
// Romaji → Katakana 변환 (숫자+영어 혼합 안전 처리)
// ----------------------

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
function isRomaji(text) {
  const romajiPattern = /(sh|ch|ts|ky|ry|ny|hy|my|py|by|gy|j|ou|uu|aa|ii|ee|oo)/i;
  const onlyLatin = /^[a-zA-Z0-9\s\-:]+$/.test(text);
  return onlyLatin && romajiPattern.test(text);
}

// ----------------------
// 번역 실패 감지
// ----------------------
function translationFailed(original, translated) {
  if (!translated) return true;
  const cleanOriginal = original.toLowerCase().replace(/\s+/g, "");
  const cleanTranslated = translated.toLowerCase().replace(/\s+/g, "");
  return cleanOriginal === cleanTranslated;
}

function FallbackText(translatedText) {
  if (!translatedText) return "";

  let fixed = translatedText.trim();

  for (const { from, to } of wordReplacements) {
    // 단어 경계 제거, g = 모두 교체, i = 대소문자 무시
    const regex = new RegExp(from, "gi");
    fixed = fixed.replace(regex, to);
  }
  return fixed;
}

module.exports = { romajiToKatakana, translate, isRomaji, translationFailed, FallbackText };
