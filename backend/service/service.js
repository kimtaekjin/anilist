const express = require("express");
const fetch = require("node-fetch"); // 반드시 이렇게 import
const router = express.Router();
const Translation = require("../models/translation");

const GOOGLE_KEY = process.env.GOOGLETRANSLATION;

router.use(express.json());

router.post("/translate", async (req, res) => {
  const { text, target } = req.body;
  const targetLang = target || "ko";

  try {
    const cached = await Translation.findOne({ originalText: text, targetLang });

    if (
      cached &&
      cached.translatedText &&
      cached.translatedText.trim() !== "" &&
      (targetLang !== "ko" || /[가-힣]/.test(cached.translatedText))
    ) {
      return res.json({
        translatedText: cached.translatedText,
        cached: true,
      });
    }

    // 🔽 캐시가 없거나, 번역 품질이 이상한 경우 API 호출
    const response = await fetch(`https://translation.googleapis.com/language/translate/v2?key=${GOOGLE_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ q: [text], target: targetLang }),
    });

    const data = await response.json();
    if (data.error) return res.status(500).json({ error: data.error });

    const translatedText = data.data?.translations?.[0]?.translatedText || text;

    // 🔽 upsert로 저장 (중복 방지)
    await Translation.findOneAndUpdate(
      { originalText: text, targetLang },
      { translatedText },
      { upsert: true, new: true }
    );

    res.json({ translatedText, cached: false });
  } catch (err) {
    console.error("Translation API 오류:", err);
    res.status(500).json({ error: "Translation failed" });
  }
});

module.exports = router;
