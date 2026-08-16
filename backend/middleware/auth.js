import jwt from "jsonwebtoken";
import User from "../models/User.js";

export async function resolveAuthenticatedUser(req) {
  const token = req.cookies?.token;
  if (!token) return null;

  const payload = jwt.verify(token, process.env.JWT_SECRET);
  const user = await User.findById(payload.userId).select("email username admin isActive tokenVersion").lean();

  if (!user || !user.isActive || (user.tokenVersion || 0) !== (payload.tokenVersion || 0)) {
    return null;
  }

  return {
    userId: user._id.toString(),
    email: user.email,
    userName: user.username,
    admin: user.admin === true,
    tokenVersion: user.tokenVersion || 0,
  };
}

export async function requireAuth(req, res, next) {
  try {
    req.user = await resolveAuthenticatedUser(req);
    if (!req.user) return res.status(401).json({ message: "로그인이 필요합니다." });
    return next();
  } catch {
    return res.status(401).json({ message: "유효하지 않은 로그인 정보입니다." });
  }
}

export async function optionalAuth(req, res, next) {
  try {
    req.user = await resolveAuthenticatedUser(req);
  } catch {
    req.user = null;
  }
  return next();
}
