const express = require("express");
const app = express();
const PORT = 3000;
const cors = require("cors");
const mongoose = require("mongoose");
require("dotenv").config();

const service = require("./service/service");

app.use(
  cors({
    origin: "http://localhost:3001", //배포할 경우 배포한 도메인을 새로 넣어줘야 한다!
    // credentials: true,
  })
);

app.use("/service", service);

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log("MongoDB연결이 성공하였습니다");
  })
  .catch((error) => {
    console.log("MongoDB연결이 실패하였습니다", error);
  });

app.listen(PORT, () => {
  console.log("server is running:", PORT);
});
