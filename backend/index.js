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
const PORT = 3000;

// ----------------------
// 미들웨어
// ----------------------
app.use(cookieParser());

const isProd = process.env.NODE_ENV === "production";
app.use(
  cors({
    origin: isProd ? process.env.CLIENT_URL : process.env.SERVER_URL, // 배포 시 도메인 변경 필요
    credentials: true,
  }),
);

app.use("/service", service);
app.use("/user", user);
app.use("/post", post);

// ----------------------
// MongoDB 연결
// ----------------------
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log("MongoDB 연결 성공");
  })
  .catch((error) => {
    console.log("MongoDB 연결 실패", error);
  });

// ----------------------
// 서버 시작
// ----------------------
app.listen(PORT, () => {
  console.log("Server running on port:", PORT);
});
