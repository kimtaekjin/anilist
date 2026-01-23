const express = require("express");
const router = express.Router();
const Translation = require("../models/Translation");
const { romajiToKatakana, translate, isRomaji, replaceMistranslation } = require("../components/translateItem");

router.use(express.json());

// ----------------------
// 번역 라우트

// ----------------------
router.post("/translate", async (req, res) => {
  const { text } = req.body;
  const targetLang = "ko";

  if (!text || typeof text !== "string") {
    return res.status(400).json({ error: "Invalid 'text' parameter" });
  }

  const originalText = text.trim();
  let sourceLang = "auto";
  let convertedText = originalText;

  try {
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

    // Romaji 감지 시 Katakana 변환
    if (isRomaji(originalText)) {
      sourceLang = "ja";
      convertedText = romajiToKatakana(originalText);
      console.log(convertedText);
    }

    // Google Translate 호출
    let translatedText = await translate(convertedText, sourceLang, targetLang);

    //오번역 된 단어 교체
    translatedText = replaceMistranslation(translatedText);

    // console.log("확인2:", originalText, " ", translatedText, " ", sourceLang);

    // DB 저장 (originalText + targetLang 기준, convertedText도 기록)
    await Translation.findOneAndUpdate(
      { originalText, targetLang },
      {
        convertedText,
        translatedText,
        sourceLang,
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
