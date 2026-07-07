import mongoose from "mongoose";

const translationSchema = new mongoose.Schema(
  {
    originalText: { type: String, required: true, trim: true },
    sourceLang: { type: String, default: "auto", trim: true },
    targetLang: { type: String, required: true, trim: true },
    translatedText: { type: String, required: true, trim: true },
    provider: { type: String, default: "deepl", trim: true },
  },
  { timestamps: true },
);

translationSchema.index(
  { provider: 1, originalText: 1, sourceLang: 1, targetLang: 1 },
  { unique: true },
);

export default mongoose.model("Translation", translationSchema);
