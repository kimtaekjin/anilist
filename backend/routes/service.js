const express = require("express");
const router = express.Router();
const Translation = require("../models/translation");
const {
  romajiToKatakana,
  translate,
  isRomaji,
  translationFailed,
  FallbackText,
} = require("../components/translateItem");

router.use(express.json());

// ----------------------
// 번역 라우트
// ----------------------
router.post("/translate", async (req, res) => {
  const { text, target } = req.body;
  const targetLang = target?.trim() || "ko";

  // console.log("확인:", text, " ", target);

  if (!text || typeof text !== "string") {
    return res.status(400).json({ error: "Invalid 'text' parameter" });
  }

  const originalText = text.trim();
  let sourceLang = "auto";
  let convertedText = originalText;

  try {
    // Romaji 감지 시 Katakana 변환
    if (isRomaji(originalText)) {
      sourceLang = "ja";
      convertedText = romajiToKatakana(originalText);

      // console.log("확인용::", convertedText);
    }

    console.log(convertedText);

    // DB 캐시 확인 (originalText + targetLang 기준)
    const cached = await Translation.findOne({
      originalText,
      targetLang,
    });

    if (cached?.translatedText?.trim()) {
      return res.json({
        translatedText: cached.translatedText,
        cached: true,
      });
    }

    // Google Translate 호출
    let translatedText = await translate(convertedText, sourceLang, targetLang);

    // 번역 실패 시 재시도 (sourceLang="auto" 또는 "ja")
    if (translationFailed(originalText, translatedText)) {
      const retrySource = sourceLang === "ja" ? "auto" : sourceLang;
      const retry = await translate(convertedText, retrySource, targetLang);
      if (!translationFailed(originalText, retry)) translatedText = retry;
    }

    translatedText = FallbackText(translatedText);

    // DB 저장 (originalText + targetLang 기준, convertedText도 기록)
    await Translation.findOneAndUpdate(
      { originalText, targetLang },
      {
        translatedText,
        sourceLang,
        convertedText,
      },
      { upsert: true, setDefaultsOnInsert: true }
    );

    res.json({ translatedText, cached: false });
  } catch (err) {
    console.error("Translation API 또는 DB 오류:", err);
    res.status(500).json({ error: "Translation failed" });
  }
});

module.exports = router;
