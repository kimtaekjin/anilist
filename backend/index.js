import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
import service from "./routes/service.js";
import user from "./routes/user.js";
import post from "./routes/post.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cookieParser());

const isProd = process.env.NODE_ENV === "production";
app.use(
  cors({
    origin: isProd ? process.env.CLIENT_URL : process.env.SERVER_URL, // 배포 시 도메인 변경 필요
    // origin: process.env.CLIENT_URL,
    credentials: true,
  }),
);

app.use("/service", service);
app.use("/user", user);
app.use("/post", post);

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log("MongoDB 연결 성공");
    app.listen(PORT, () => {
      console.log("Server running on port:", PORT);
    });
  })
  .catch((err) => {
    console.error("MongoDB 연결 실패", err);
    process.exit(1); // 서버 종료
  });
