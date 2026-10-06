import express from "express";
import crypto from "crypto";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import nodemailer from "nodemailer";
import User from "../models/User.js";
import redis from "../config/redis.js";
import { requireAuth } from "../middleware/auth.js";
import { createRateLimiter } from "../middleware/security.js";
import { normalizeEmail, validateEmail, validatePassword, validateUsername } from "../utils/userValidation.js";

const router = express.Router();
const LOGIN_LOCK_MS = 15 * 60 * 1000;
const MAX_LOGIN_FAILURES = 5;
const genericLoginMessage = "이메일 또는 비밀번호가 올바르지 않습니다.";

const signupLimiter = createRateLimiter({ limit: 5, windowMs: 60 * 60 * 1000, store: redis, name: "signup" });
const loginLimiter = createRateLimiter({ limit: 10, windowMs: 15 * 60 * 1000, store: redis, name: "login" });
const passwordResetLimiter = createRateLimiter({
  limit: 5,
  windowMs: 60 * 60 * 1000,
  store: redis,
  name: "password-reset",
});

let mailTransporter;
function getMailTransporter() {
  if (!mailTransporter) {
    mailTransporter = nodemailer.createTransport({
      service: "gmail",
      pool: true,
      auth: { user: process.env.MAIL_USER, pass: process.env.MAIL_PASS },
    });
  }
  return mailTransporter;
}

const getAuthCookieOptions = () => {
  const isProd = process.env.NODE_ENV === "production";
  return { httpOnly: true, secure: isProd, sameSite: isProd ? "none" : "strict", path: "/" };
};

function createAuthUser(user) {
  return {
    userId: user._id.toString(),
    email: user.email,
    userName: user.username,
    admin: user.admin === true,
  };
}

router.post("/signup", signupLimiter, async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  const username = typeof req.body?.username === "string" ? req.body.username.trim() : "";
  const password = req.body?.password;

  if (!validateEmail(email) || !validateUsername(username) || !validatePassword(password)) {
    return res.status(400).json({
      message: "이메일, 닉네임(2~30자), 비밀번호(영문과 숫자를 포함한 8~72자)를 확인해 주세요.",
    });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 12);
    await User.create({ email, password: hashedPassword, username });
    return res.status(201).json({ message: "회원가입이 완료되었습니다." });
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(409).json({ message: "이미 사용 중인 이메일 또는 닉네임입니다." });
    }
    console.error("회원가입 오류:", error);
    return res.status(500).json({ message: "서버 오류가 발생했습니다." });
  }
});

router.post("/login", loginLimiter, async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  const password = req.body?.password;
  if (!validateEmail(email) || typeof password !== "string") {
    return res.status(401).json({ message: genericLoginMessage });
  }

  try {
    const user = await User.findOne({ email }).select("+password");
    if (!user || !user.isActive) return res.status(401).json({ message: genericLoginMessage });

    const lockActive =
      user.failedLoginAttempts >= MAX_LOGIN_FAILURES &&
      user.lastLoginAttempt &&
      Date.now() - user.lastLoginAttempt.getTime() < LOGIN_LOCK_MS;
    if (lockActive) {
      return res.status(429).json({ message: "로그인 시도가 너무 많습니다. 잠시 후 다시 시도해 주세요." });
    }
    if (user.failedLoginAttempts >= MAX_LOGIN_FAILURES) user.failedLoginAttempts = 0;

    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      user.failedLoginAttempts += 1;
      user.lastLoginAttempt = new Date();
      await user.save();
      return res.status(401).json({ message: genericLoginMessage });
    }

    user.failedLoginAttempts = 0;
    user.lastLoginAttempt = new Date();
    await user.save();

    const authUser = createAuthUser(user);
    const token = jwt.sign(
      { ...authUser, tokenVersion: user.tokenVersion || 0 },
      process.env.JWT_SECRET,
      { expiresIn: "24h" },
    );
    res.cookie("token", token, { ...getAuthCookieOptions(), maxAge: 24 * 60 * 60 * 1000 });
    return res.json({ user: authUser, message: "로그인되었습니다." });
  } catch (error) {
    console.error("로그인 오류:", error.message);
    return res.status(500).json({ message: "서버 오류가 발생했습니다." });
  }
});

router.post("/logout", (req, res) => {
  res.clearCookie("token", getAuthCookieOptions());
  return res.json({ message: "로그아웃되었습니다." });
});

router.get("/verify-token", requireAuth, (req, res) => {
  const { tokenVersion, ...authUser } = req.user;
  return res.status(200).json({ isValid: true, user: authUser });
});

router.post("/forgot-password", passwordResetLimiter, async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  const clientUrl = process.env.CLIENT_URL;
  const successMessage = "계정이 존재하면 비밀번호 재설정 메일을 발송합니다.";
  if (!validateEmail(email)) return res.status(400).json({ message: "올바른 이메일을 입력해 주세요." });

  let user;
  try {
    user = await User.findOne({ email });
    if (!user) return res.status(200).json({ message: successMessage });

    const resetToken = crypto.randomBytes(32).toString("hex");
    user.resetPasswordToken = crypto.createHash("sha256").update(resetToken).digest("hex");
    user.resetPasswordExpire = Date.now() + 10 * 60 * 1000;
    await user.save();

    const resetUrl = `${clientUrl}/user/reset-password?token=${encodeURIComponent(resetToken)}`;
    await getMailTransporter().sendMail({
      from: `"Aniwiki" <${process.env.MAIL_USER}>`,
      to: email,
      subject: "비밀번호 재설정 안내",
      html: `<p>아래 링크에서 비밀번호를 재설정하세요. (10분간 유효)</p><a href="${resetUrl}">${resetUrl}</a>`,
    });
    return res.status(200).json({ message: successMessage });
  } catch (error) {
    if (user) {
      user.resetPasswordToken = undefined;
      user.resetPasswordExpire = undefined;
      await user.save().catch(() => {});
    }
    console.error("비밀번호 재설정 요청 오류:", error);
    return res.status(500).json({ message: "서버 오류가 발생했습니다." });
  }
});

router.post("/reset-password", passwordResetLimiter, async (req, res) => {
  const { token, password } = req.body || {};
  if (typeof token !== "string" || !token || !validatePassword(password)) {
    return res.status(400).json({ message: "재설정 토큰과 새 비밀번호를 확인해 주세요." });
  }

  try {
    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");
    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpire: { $gt: Date.now() },
    }).select("+password");
    if (!user) return res.status(400).json({ message: "토큰이 유효하지 않거나 만료되었습니다." });

    user.password = await bcrypt.hash(password, 12);
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    user.tokenVersion = (user.tokenVersion || 0) + 1;
    await user.save();

    res.clearCookie("token", getAuthCookieOptions());
    return res.status(200).json({ message: "비밀번호가 성공적으로 변경되었습니다. 다시 로그인해 주세요." });
  } catch (error) {
    console.error("비밀번호 재설정 오류:", error);
    return res.status(500).json({ message: "서버 오류가 발생했습니다." });
  }
});

router.delete("/me", requireAuth, async (req, res) => {
  const password = req.body?.password;
  if (!validatePassword(password)) return res.status(400).json({ message: "Account deletion requires your password." });
  try {
    const user = await User.findById(req.user.userId).select("+password");
    if (!user) return res.status(401).json({ message: "Login is required." });
    if (!(await bcrypt.compare(password, user.password))) return res.status(401).json({ message: "The password is incorrect." });
    await user.deleteOne();
    res.clearCookie("token", getAuthCookieOptions());
    return res.json({ message: "Account deleted." });
  } catch (error) {
    console.error("Account deletion failed:", error);
    return res.status(500).json({ message: "A server error occurred." });
  }
});

export default router;
