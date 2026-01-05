const express = require("express");
const fetch = require("node-fetch");
const router = express.Router();
const Translation = require("../models/translation");
const wanakana = require("wanakana");

const GOOGLE_KEY = process.env.GOOGLETRANSLATION;

router.use(express.json());

// ----------------------
// Romaji 판단
// ----------------------
function isRomaji(text) {
  const romajiPattern = /(sh|ch|ts|ky|ry|ny|hy|my|py|by|gy|j|ou|uu|aa|ii|ee|oo)/i;
  const onlyLatin = /^[a-zA-Z0-9\s\-:]+$/.test(text);
  return onlyLatin && romajiPattern.test(text);
}

function fixTitleTranslation(text) {
  if (!text) return "";

  // 번역이 제대로 되지 않은 제목의 경우 특정 패턴 넣어서 번역
  const trimmed = text.trim();
  const fixed = trimmed.replace(/(【)추시의 아이(】)/g, "$1최애의 아이$2");

  return fixed;
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
// 번역 라우트
// ----------------------
router.post("/translate", async (req, res) => {
  const { text, target } = req.body;
  const targetLang = target || "ko";
  // console.log("확인용::", text);

  const originalText = text;
  let sourceLang = "auto";
  let textToTranslate = originalText;

  try {
    // Romaji 감지 시 Katakana 변환
    if (isRomaji(originalText)) {
      sourceLang = "ja";
      textToTranslate = romajiToKatakana(originalText);
      console.log("Katakana 변환:", textToTranslate, " 오리지날::", originalText);
    }

    // DB 캐시 확인
    const cached = await Translation.findOne({
      originalText,
      targetLang,
      sourceLang,
    });

    if (cached?.translatedText?.trim()) {
      return res.json({
        translatedText: cached.translatedText,
        cached: true,
      });
    }

    // Google Translate 호출
    let translatedText = await translate(textToTranslate, sourceLang, targetLang);

    // 번역 실패 시 재시도
    if (sourceLang === "ja" && translationFailed(originalText, translatedText)) {
      const retry = await translate(textToTranslate, "ja", targetLang);
      if (!translationFailed(originalText, retry)) translatedText = retry;
    }

    translatedText = fixTitleTranslation(translatedText);

    // DB 저장
    await Translation.findOneAndUpdate(
      { originalText, targetLang, sourceLang },
      { translatedText },
      { upsert: true, setDefaultsOnInsert: true }
    );

    res.json({ translatedText, cached: false });
  } catch (err) {
    console.error("Translation API 오류:", err);
    res.status(500).json({ error: "Translation failed" });
  }
});

module.exports = router;
