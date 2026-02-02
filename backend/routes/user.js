import express from "express";
const router = express.Router();

import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import User from "../models/User.js"; // mongoose 모델

router.use(express.json());

// 회원가입
// ----------------------
router.post("/signup", async (req, res) => {
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

    const user = new User({
      email,
      password: hashedPassword,
      username,
    });
    await user.save();

    res.status(201).json({ message: "회원가입이 완료되었습니다." });
  } catch (error) {
    console.error("회원가입 오류:", error);
    res.status(500).json({ message: "서버 오류가 발생했습니다." });
  }
});

// 로그인
// ----------------------
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email }).select("+password");

    if (!user) {
      return res.status(401).json({ message: "사용자를 찾을 수 없습니다." });
    }

    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      user.lastLoginAttempt = new Date();
      await user.save();
      return res.status(401).json({ message: "비밀번호가 일치하지 않습니다." });
    }

    user.failedLoginAttempts = 0;
    user.lastLoginAttempt = new Date();
    user.isLoggedIn = true;
    await user.save();

    const token = jwt.sign(
      { userId: user._id, email: user.email, userName: user.username, admin: user.admin },
      process.env.JWT_SECRET,
      {
        expiresIn: "24h",
      },
    );
    const isProd = process.env.NODE_ENV === "production";

    res.cookie("token", token, {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? "none" : "strict",
      maxAge: 24 * 60 * 60 * 1000, // 24시간
    });

    const userWithoutPassword = user.toObject();
    delete userWithoutPassword.password;

    res.json({ user: userWithoutPassword });
  } catch (error) {
    console.error("로그인 오류:", error.message);
    res.status(500).json({ message: "서버 오류가 발생했습니다." });
  }
});

// 로그아웃
// ----------------------
router.post("/logout", async (req, res) => {
  try {
    const token = req.cookies.token;

    if (!token) {
      return res.status(400).json({ message: "이미 로그아웃된 상태입니다." });
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.userId);

      if (user) {
        user.isLoggedIn = false;
        await user.save();
      }
    } catch (error) {
      console.error("토큰 검증 오류:", error.message);
    }

    res.clearCookie("token", {
      httpOnly: true,
      secure: false,
      sameSite: "strict",
    });

    res.json({ message: "로그아웃되었습니다." });
  } catch (error) {
    console.error("로그아웃 오류:", error.message);
    res.status(500).json({ message: "서버 오류가 발생했습니다." });
  }
});

// 토큰 검증
// ----------------------
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

export default router;
