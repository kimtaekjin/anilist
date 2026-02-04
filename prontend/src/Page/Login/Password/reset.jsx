import React, { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import axios from "axios";

const ResetPassword = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  useEffect(() => {
    const tokenFromUrl = searchParams.get("token");
    if (!tokenFromUrl) {
      alert("잘못된 접근입니다.");
      navigate("/user/login");
      return;
    }
    setToken(tokenFromUrl);
  }, [searchParams, navigate]);

  const handleReset = async () => {
    if (!password || !confirmPassword) {
      alert("비밀번호를 입력해주세요.");
      return;
    }
    if (password !== confirmPassword) {
      alert("비밀번호가 일치하지 않습니다.");
      return;
    }

    try {
      const response = await axios.post(
        `${process.env.REACT_APP_CLIENT_URL}/user/reset-password`,
        { token, password },
        { withCredentials: true },
      );

      alert(response.data.message);
      navigate("/user/login");
    } catch (error) {
      console.error(error);
      alert(error.response?.data?.message || "오류가 발생했습니다.");
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <div className="bg-white rounded-2xl shadow-md p-8 w-full max-w-md">
        <h2 className="text-2xl font-bold mb-6 text-center text-gray-800">비밀번호 재설정</h2>
        <div className="mt-5">
          <input
            type="password"
            className="w-full rounded-xl shadow-sm p-2 my-2 border border-gray-400"
            placeholder="새 비밀번호"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <input
            type="password"
            className="w-full rounded-xl shadow-sm p-2 my-2 border border-gray-400"
            placeholder="비밀번호 확인"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />
        </div>
        <div className="mt-8">
          <button
            type="button"
            className="w-full py-3 bg-blue-500 text-white font-semibold rounded-xl
                   hover:bg-blue-600 transition-colors"
            onClick={handleReset}
          >
            비밀번호 변경
          </button>
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;
