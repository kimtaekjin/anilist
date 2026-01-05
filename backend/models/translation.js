const mongoose = require("mongoose");

const translationSchema = new mongoose.Schema(
  {
    originalText: { type: String, required: true },
    targetLang: { type: String, required: true },
    translatedText: { type: String, required: true },
    sourceLang: { type: String, default: "auto" },
  },
  { timestamps: true }
);

// 동일 텍스트 + 대상 언어는 유니크
translationSchema.index({ originalText: 1, targetLang: 1, sourceLang: 1 }, { unique: true });

module.exports = mongoose.model("Translation", translationSchema);
