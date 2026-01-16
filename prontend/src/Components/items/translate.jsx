export const translateText = async (text) => {
  try {
    const res = await fetch("http://localhost:3000/service/translate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, target: "ko" }),
    });
    const data = await res.json();
    return data.translatedText;
  } catch (err) {
    console.error("Translation error:", err);
    return text;
  }
};
