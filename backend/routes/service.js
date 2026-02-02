import express from "express";
import Translation from "../models/Translate.js";
import { romajiToKatakana, translate, isRomaji, replaceMistranslation } from "../components/translateItem.js";

const router = express.Router();

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

    // Romaji → Katakana
    if (isRomaji(originalText)) {
      sourceLang = "ja";
      convertedText = romajiToKatakana(originalText);
      console.log(convertedText);
    }

    // 번역
    let translatedText = await translate(convertedText, sourceLang, targetLang);

    // 오번역 교체
    translatedText = replaceMistranslation(translatedText);

    // console.log("확인1:", translatedText, " :", convertedText);

    // DB 저장
    await Translation.findOneAndUpdate(
      { originalText, targetLang, sourceLang },
      {
        $setOnInsert: {
          translatedText,
          createdAt: new Date(),
        },
      },
      {
        upsert: true,
        new: true,
      },
    );

    res.json({ translatedText, cached: false });
  } catch (err) {
    console.error("Translation API 또는 DB 오류:", err);
    res.status(500).json({ error: "Translation failed" });
  }
});

export default router;
