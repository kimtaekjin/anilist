import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowRight, LockKeyhole } from "lucide-react";
import axios from "axios";
import AuthLayout, { AuthField, authButtonClass } from "../AuthLayout";
import passwordRecoveryImage from "../../../asset/auth-password-recovery.png";

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get("token");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!token || submitting) return;
    if (password !== confirmPassword) {
      setError("비밀번호가 일치하지 않습니다.");
      return;
    }

    try {
      setSubmitting(true);
      setError("");
      await axios.post(`${process.env.REACT_APP_CLIENT_URL}/user/reset-password`, { token, password }, { withCredentials: true });
      navigate("/user/Login", { replace: true });
    } catch (requestError) {
      setError(requestError.response?.data?.message || "비밀번호 변경에 실패했습니다.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout
      panelImage={passwordRecoveryImage}
      eyebrow="Set new password"
      title="새 비밀번호 설정"
      description="다른 곳에서 사용하지 않는 안전한 비밀번호로 계정을 보호해주세요."
      footer={<Link to="/user/Login" className="font-bold text-amber-300 hover:text-amber-200">로그인 화면으로 돌아가기</Link>}
    >
      {!token ? (
        <p role="alert" className="rounded-xl border border-red-400/20 bg-red-500/10 p-5 text-sm leading-6 text-red-200">재설정 링크가 올바르지 않거나 토큰이 없습니다. 비밀번호 찾기를 다시 진행해주세요.</p>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5">
          <AuthField label="새 비밀번호" icon={LockKeyhole} type="password" autoComplete="new-password" required value={password} onChange={(event) => setPassword(event.target.value)} placeholder="새 비밀번호를 입력하세요" />
          <AuthField label="비밀번호 확인" icon={LockKeyhole} type="password" autoComplete="new-password" required value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder="비밀번호를 다시 입력하세요" />
          {error ? <p role="alert" className="rounded-lg border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</p> : null}
          <button type="submit" disabled={submitting} className={authButtonClass}>
            {submitting ? "변경 중..." : "비밀번호 변경"}
            {!submitting ? <ArrowRight size={17} /> : null}
          </button>
        </form>
      )}
    </AuthLayout>
  );
}
