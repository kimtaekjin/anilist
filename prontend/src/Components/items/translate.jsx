import axios from "axios";

export const translateText = async (text) => {
  const API_URL = process.env.CLIENT_URL;
  try {
    const { data } = await axios.post(`${API_URL}/service/translate`, { text });
    return data.translatedText;
  } catch (err) {
    console.error("Translation error:", err);
    return text;
  }
};
