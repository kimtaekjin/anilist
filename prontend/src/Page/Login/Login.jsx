import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, LockKeyhole, Mail } from "lucide-react";
import axios from "axios";
import { useAuth } from "../../context/AuthContext";
import AuthLayout, { AuthField, authButtonClass } from "./AuthLayout";
import loginReviewImage from "../../asset/auth-login-review.png";

export default function Login() {
  const navigate = useNavigate();
  const { user, loading, checkAuth } = useAuth();
  const API_URL = process.env.REACT_APP_CLIENT_URL;
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!loading && user) navigate("/", { replace: true });
  }, [loading, user, navigate]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (submitting) return;

    try {
      setSubmitting(true);
      setError("");
      await axios.post(`${API_URL}/user/login`, { email: email.trim(), password }, { withCredentials: true });
      await checkAuth();
      navigate("/", { replace: true });
    } catch (requestError) {
      setError(requestError.response?.data?.message || "로그인에 실패했습니다. 입력 정보를 확인해주세요.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout
      panelImage={loginReviewImage}
      eyebrow="Welcome back"
      title="다시 만나 반가워요"
      description="계정에 로그인하고 관심 작품과 커뮤니티 활동을 이어가세요."
      footer={<>아직 계정이 없나요? <Link to="/user/singUp" className="font-bold text-amber-300 hover:text-amber-200">회원가입</Link></>}
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        <AuthField label="이메일" icon={Mail} type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" />
        <AuthField label="비밀번호" icon={LockKeyhole} type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} placeholder="비밀번호를 입력하세요" />
        {error ? <p role="alert" className="rounded-lg border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</p> : null}
        <div className="flex justify-end">
          <Link to="/user/find" className="text-xs font-semibold text-stone-500 transition hover:text-amber-300">비밀번호를 잊으셨나요?</Link>
        </div>
        <button type="submit" disabled={submitting} className={authButtonClass}>
          {submitting ? "로그인 중..." : "로그인"}
          {!submitting ? <ArrowRight size={17} /> : null}
        </button>
      </form>
    </AuthLayout>
  );
}
