const express = require("express");
const router = express.Router();
const bcrypt = require("bcrypt");
const User = require("../models/User");
const jwt = require("jsonwebtoken");

router.use(express.json());

router.post("/singup", async (req, res) => {
  try {
    const { username, password, email } = req.body;

    const existNick = await User.findOne({ username });
    const existUser = await User.findOne({ email });

    if (existUser) {
      return res.status(400).json({ message: "이미 존재하는 사용자입니다." });
    }

    if (existNick) {
      return res.status(400).json({ message: "이미 존재하는 닉네임입니다." });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    console.log("여기 오는지");

    const user = new User({
      email,
      password: hashedPassword,
      username,
    });
    await user.save();
    res.status(201).json({ message: "회원가입이 완료되었습니다." });
  } catch (error) {
    res.status(500).json({ message: "서버 오류가 발생했습니다." });
    console.log(error);
  }
});

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email }).select("+password");

    if (!user) {
      return res.status(401).json({ message: "사용자를 찾을 수 없습니다." });
    }

    // if (!user.isActive) {
    //   return res.status(401).json({ message: "비활성화된 계정입니다. 관리자에게 문의하세요." });
    // }
    //   if (user.isLoggedIn) {
    //     return res.status(401).json({ message: "이미 다른 기기에서 로그인되어 있습니다." });
    //   }

    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      //   user.failedLoginAttempts += 1;
      user.lastLoginAttempt = new Date();

      //   if (user.failedLoginAttempts >= 5) {
      //     user.isActive = false;
      //     await user.save();
      //     return res.status(401).json({
      //       message: "비밀번호를 5회 이상 틀려 계정이 비활성화되었습니다.",
      //     });
      //   }

      await user.save();
      return res.status(401).json({
        message: "비밀번호가 일치하지 않습니다.",
        // remainingAttempts: 5 - user.failedLoginAttempts,
      });
    }

    user.failedLoginAttempts = 0;
    user.lastLoginAttempt = new Date();
    user.isLoggedIn = true;

    // try {
    //   const response = await axios.get("https://api.ipify.org?format=json"); //사용자의 공인ip를 받아오는 코드
    //   const ipAddress = response.data.ip;
    //   user.ipAddress = ipAddress;
    // } catch (ipError) {
    //   console.error("IP 주소를 가져오는 중 오류 발생:", ipError.message);
    // }

    await user.save();

    const token = jwt.sign(
      { userId: user._id, email: user.email, userName: user.username }, //여기서 값을 넣을때는 몽고DB의 컬럼값을 기준으로 한다.
      process.env.JWT_SECRET, //jwt는 시크릿키를 발급하여 이를 통해 jwt토큰을 생성 및 유통을 한다.
      { expiresIn: "24h" } //JWT의 유효기간
    );

    res.cookie("token", token, {
      httpOnly: true, //자바스크립트로 토큰을 못 가져오게 하는 설정 -보안강화-
      secure: false, //보통 환경 변수를 확인해서 개발 환경에서는 false, 배포 환경에서는 true로 설정하는 방식
      sameSite: "strict", //CSRF 공격 방지용 ,외부 사이트에서 우리 서버에 POST 요청을 보내도 쿠키가 안 붙
      maxAge: 24 * 60 * 60 * 1000, //24H
    });

    const userWithoutPassword = user.toObject();
    delete userWithoutPassword.password;
    // /*클라이언트로 보내는 json 데이터에서 패스워드 부분을 지우기
    //   이는 패스워드가 노출되는 위험을 없애기 위함
    // */

    res.json({ user: userWithoutPassword });
  } catch (error) {
    console.error("서버 오류:", error.message);
    res.status(500).json({ message: "서버 오류가 발생했습니다." });
  }
});

router.post("/logout", async (req, res) => {
  try {
    const token = req.cookies.token;

    if (!token) {
      return res.status(400).json({ message: "이미 로그아웃된 상태입니다." });
      //400에러는 클라이언트가 보낸 요청(request)에 문제가 있어서 서버가 처리할 수 없는 상태
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      //클라이언트 토큰과 env의 토큰 값을 비교하여 검증

      const user = await User.findById(decoded.userId);

      if (user) {
        user.isLoggedIn = false;
        await user.save();
      }
    } catch (error) {
      console.log("토큰 검증 오류: ", error.message);
    }

    res.clearCookie("token", {
      httpOnly: true,
      secure: false,
      sameSite: "strict",
    });

    res.json({ message: "로그아웃되었습니다." });
  } catch (error) {
    console.log("로그아웃 오류: ", error.message);
    res.status(500).json({ message: "서버 오류가 발생했습니다." });
  }
});

router.get("/verify-token", (req, res) => {
  const token = req.cookies.token;

  if (!token) {
    return res.status(400).json({ isValid: false, message: "토큰이 유효하지 않습니다." });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    return res.status(200).json({ isValid: true, user: decoded });
  } catch (error) {
    return res.status(401).json({ isValid: false, message: "유효하지 않은 토큰입니다." });
  }
});

module.exports = router;
