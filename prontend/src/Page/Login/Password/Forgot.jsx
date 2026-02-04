import React, { useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";

const PasswordForgot = () => {
  const [email, setEmail] = useState("");
  const navigate = useNavigate();

  const handlePasswordFG = async () => {
    if (!email) {
      alert("이메일을 입력해주세요.");
      return;
    }

    try {
      const response = await axios.post(
        `${process.env.REACT_APP_CLIENT_URL}/user/forgot-password`,
        { email },
        { withCredentials: true },
      );

      alert(response.data.message);
      navigate("/");
    } catch (error) {
      console.error(error);
      alert("오류가 발생했습니다.");
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <div className="bg-white rounded-2xl shadow-md p-8 w-full max-w-md">
        <h2 className="text-2xl font-bold mb-6 text-center text-gray-800">비밀번호 찾기</h2>
        <div className="mt-5">
          <h1>이메일</h1>
          <input
            type="email"
            className="w-full rounded-xl shadow-sm p-2 my-2 border border-gray-400"
            placeholder="이메일을 입력해주세요."
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="mt-8">
          <button
            type="button"
            className="w-full py-3 bg-blue-500 text-white font-semibold rounded-xl
               hover:bg-blue-600 transition-colors
               disabled:bg-gray-300 disabled:cursor-not-allowed"
            onClick={handlePasswordFG}
          >
            확인
          </button>
        </div>
      </div>
    </div>
  );
};

export default PasswordForgot;
