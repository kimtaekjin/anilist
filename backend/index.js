import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import cookieParser from "cookie-parser";
import "dotenv/config";

import service from "./routes/service.js";
import user from "./routes/user.js";
import post from "./routes/post.js";
import { startAnimeSync } from "./jobs/syncAnime.js";

const app = express();
const PORT = process.env.PORT || 8080;

const allowedOrigins = [process.env.CLIENT_URL, process.env.SERVER_URL].filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(null, false);
    },
    credentials: true,
  }),
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.use("/service", service);
app.use("/user", user);
app.use("/post", post);

app.get("/healthz", (req, res) => res.send("OK"));

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log("MongoDB 연결 성공");
    if (process.env.ANIME_SYNC_ENABLED === "true") {
      startAnimeSync();
    } else {
      console.log("애니 자동 동기화 비활성화: cron/job에서 npm run sync:anime로 실행하세요.");
    }
  })
  .catch((err) => console.error("MongoDB 연결 실패", err));

app.listen(PORT, () => {
  console.log("Server running on port:", PORT);
});
