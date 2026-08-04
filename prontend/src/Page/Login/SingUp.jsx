import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, LockKeyhole, Mail, UserRound } from "lucide-react";
import axios from "axios";
import { useAuth } from "../../context/AuthContext";
import AuthLayout, { AuthField, authButtonClass } from "./AuthLayout";
import signupCommunityImage from "../../asset/auth-signup-community.png";

export default function SignUp() {
  const navigate = useNavigate();
  const API_URL = process.env.REACT_APP_CLIENT_URL;
  const { user, loading } = useAuth();
  const [nickname, setNickname] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!loading && user) navigate("/", { replace: true });
  }, [loading, user, navigate]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (submitting) return;
    if (password !== passwordConfirm) {
      setError("비밀번호가 일치하지 않습니다.");
      return;
    }

    try {
      setSubmitting(true);
      setError("");
      await axios.post(`${API_URL}/user/signup`, { username: nickname.trim(), email: email.trim(), password });
      navigate("/user/Login", { replace: true });
    } catch (requestError) {
      setError(requestError.response?.data?.message || "회원가입에 실패했습니다. 잠시 후 다시 시도해주세요.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout
      panelImage={signupCommunityImage}
      eyebrow="Join the community"
      title="ANIWIKI 시작하기"
      description="간단한 정보만 입력하면 작품을 추천하고 이야기를 나눌 수 있습니다."
      footer={<>이미 계정이 있나요? <Link to="/user/Login" className="font-bold text-amber-300 hover:text-amber-200">로그인</Link></>}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <AuthField label="닉네임" icon={UserRound} type="text" autoComplete="nickname" minLength={2} maxLength={30} required value={nickname} onChange={(event) => setNickname(event.target.value)} placeholder="사용할 닉네임" />
        <AuthField label="이메일" icon={Mail} type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" />
        <AuthField label="비밀번호" icon={LockKeyhole} type="password" autoComplete="new-password" required value={password} onChange={(event) => setPassword(event.target.value)} placeholder="비밀번호를 입력하세요" />
        <AuthField label="비밀번호 확인" icon={LockKeyhole} type="password" autoComplete="new-password" required value={passwordConfirm} onChange={(event) => setPasswordConfirm(event.target.value)} placeholder="비밀번호를 다시 입력하세요" />
        {error ? <p role="alert" className="rounded-lg border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</p> : null}
        <button type="submit" disabled={submitting} className={authButtonClass}>
          {submitting ? "가입 중..." : "회원가입"}
          {!submitting ? <ArrowRight size={17} /> : null}
        </button>
      </form>
    </AuthLayout>
  );
}
