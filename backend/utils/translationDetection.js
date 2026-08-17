function hasKorean(text) {
  return /[\uac00-\ud7a3]/.test(text);
}

function hasJapanese(text) {
  return /[\u3040-\u30ff\u3400-\u9fff]/.test(text);
}

export function needsKoreanTranslation(text) {
  if (!text || typeof text !== "string") return false;

  // Japanese text must be translated even when a Korean annotation is mixed in.
  // Latin text is translated only when the value is not already primarily Korean.
  return hasJapanese(text) || (!hasKorean(text) && /[A-Za-z]/.test(text));
}
