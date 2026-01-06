import React from "react";

const SignUp = () => {
  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <div className="bg-white rounded-2xl shadow-md p-8 w-full max-w-md">
        <h2 className="text-2xl font-bold mb-6 text-center text-gray-800">회원가입</h2>

        <form className="space-y-4">
          <input
            type="text"
            placeholder="닉네임"
            className="w-full border border-gray-300 rounded px-4 py-2 focus:outline-none focus:ring-1 focus:ring-gray-400 transition"
          />
          <input
            type="email"
            placeholder="이메일"
            className="w-full border border-gray-300 rounded px-4 py-2 focus:outline-none focus:ring-1 focus:ring-gray-400 transition"
          />
          <input
            type="password"
            placeholder="비밀번호"
            className="w-full border border-gray-300 rounded px-4 py-2 focus:outline-none focus:ring-1 focus:ring-gray-400 transition"
          />
          <input
            type="password"
            placeholder="비밀번호 확인"
            className="w-full border border-gray-300 rounded px-4 py-2 focus:outline-none focus:ring-1 focus:ring-gray-400 transition"
          />
          <button type="submit" className="w-full bg-blue-500 text-white py-2 rounded hover:bg-blue-600 transition">
            회원가입
          </button>
        </form>

        <p className="text-sm text-center mt-4 text-gray-600">
          이미 계정이 있나요?{" "}
          <a href="/login" className="text-blue-500 hover:underline">
            로그인
          </a>
        </p>
      </div>
    </div>
  );
};

export default SignUp;
