import axios from "axios";

export const translateText = async (text) => {
  try {
    const { data } = await axios.post("http://localhost:3000/service/translate", { text });
    return data.translatedText;
  } catch (err) {
    console.error("Translation error:", err);
    return text;
  }
};
