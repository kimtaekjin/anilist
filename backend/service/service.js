const express = require("express");
const fetch = require("node-fetch"); // 반드시 이렇게 import
const router = express.Router();
const Translation = require("../models/translation");

const GOOGLE_KEY = process.env.GOOGLETRANSLATION;

router.use(express.json());

router.post("/translate", async (req, res) => {
  const { text, target } = req.body;

  try {
    const response = await fetch(`https://translation.googleapis.com/language/translate/v2?key=${GOOGLE_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ q: [text], target: target || "ko" }),
    });

    const data = await response.json();

    if (data.error) {
      return res.status(500).json({ error: data.error });
    }

    const translatedText = data.data?.translations?.[0]?.translatedText || text;
    res.json({ translatedText });
  } catch (err) {
    console.error("Translation API 오류:", err);
    res.status(500).json({ error: "Translation failed" });
  }
});

module.exports = router;
