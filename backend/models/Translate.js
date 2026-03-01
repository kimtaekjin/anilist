import mongoose from "mongoose";

const translationSchema = new mongoose.Schema(
  {
    originalText: { type: String, required: true },
    targetLang: { type: String, required: true },
    translatedText: { type: String, required: true },
    sourceLang: { type: String, default: "auto" },
  },
  { timestamps: true },
);

//현재 사용하지 않음 잘못 설계한 데이터베이스구조

// 동일 텍스트 + 대상 언어 + 원본 언어는 유니크
translationSchema.index({ originalText: 1, targetLang: 1, sourceLang: 1 }, { unique: true });

export default mongoose.model("Translation", translationSchema);
