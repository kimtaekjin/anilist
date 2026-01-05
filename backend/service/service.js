const express = require("express");
const fetch = require("node-fetch");
const router = express.Router();
const Translation = require("../models/translation");
const wanakana = require("wanakana");
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
  const targetLang = target || "ko";

  const originalText = text;
  let sourceLang = "auto";
  let textToTranslate = originalText;

  try {
    // Romaji 감지 시 Katakana 변환
    if (isRomaji(originalText)) {
      sourceLang = "ja";
      textToTranslate = romajiToKatakana(originalText);
      // console.log("Katakana 변환:", textToTranslate, " 오리지날::", originalText);
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

    translatedText = FallbackText(translatedText);
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
