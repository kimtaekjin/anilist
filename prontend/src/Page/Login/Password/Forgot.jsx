import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Mail } from "lucide-react";
import axios from "axios";
import AuthLayout, { AuthField, authButtonClass } from "../AuthLayout";
import passwordRecoveryImage from "../../../asset/auth-password-recovery.png";

export default function PasswordForgot() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (submitting) return;

    try {
      setSubmitting(true);
      setError("");
      await axios.post(`${process.env.REACT_APP_CLIENT_URL}/user/forgot-password`, { email: email.trim() }, { withCredentials: true });
      setSent(true);
    } catch (requestError) {
      setError(requestError.response?.data?.message || "메일 발송에 실패했습니다. 잠시 후 다시 시도해주세요.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout
      panelImage={passwordRecoveryImage}
      eyebrow="Account recovery"
      title="비밀번호 찾기"
      description="가입한 이메일을 입력하면 비밀번호를 다시 설정할 수 있는 링크를 보내드립니다."
      footer={<Link to="/user/Login" className="font-bold text-amber-300 hover:text-amber-200">로그인 화면으로 돌아가기</Link>}
    >
      {sent ? (
        <div className="rounded-xl border border-emerald-400/20 bg-emerald-500/10 p-5">
          <h2 className="font-bold text-emerald-200">메일을 확인해주세요</h2>
          <p className="mt-2 text-sm leading-6 text-stone-300">입력한 이메일로 재설정 링크를 보냈습니다. 메일이 보이지 않으면 스팸함도 확인해주세요.</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5">
          <AuthField label="이메일" icon={Mail} type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" />
          {error ? <p role="alert" className="rounded-lg border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</p> : null}
          <button type="submit" disabled={submitting} className={authButtonClass}>
            {submitting ? "발송 중..." : "재설정 링크 받기"}
            {!submitting ? <ArrowRight size={17} /> : null}
          </button>
        </form>
      )}
    </AuthLayout>
  );
}
