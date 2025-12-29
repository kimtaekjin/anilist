const express = require("express");
const app = express();
const PORT = 3000;
const cors = require("cors");
require("dotenv").config();

const service = require("./service/service");

app.use(
  cors({
    origin: "http://localhost:3001", //배포할 경우 배포한 도메인을 새로 넣어줘야 한다!
    // credentials: true,
  })
);

app.use("/service", service);

app.listen(PORT, () => {
  console.log("server is running:", PORT);
});
