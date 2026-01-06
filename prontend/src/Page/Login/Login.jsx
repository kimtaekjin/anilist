import React from "react";
import loginImage from "../../asset/login.jpg";

const Login = () => {
  return (
    <div className="flex items-center justify-center min-h-screen bg-white">
      <div className="flex rounded-lg overflow-hidden">
        {/* 이미지 영역 */}
        <div className="w-1/2" style={{ height: "400px" }}>
          <img src={loginImage} alt="login" className="w-full h-full object-cover" />
        </div>

        {/* 로그인 폼 */}
        <div className="bg-gray-100 p-8 w-1/2 max-w-md flex flex-col justify-center" style={{ height: "400px" }}>
          <h3 className="text-2xl font-bold mb-6 text-center">Login</h3>
          <form>
            <input
              type="text"
              placeholder="Email"
              className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none mb-4"
            />
            <input
              type="password"
              placeholder="Password"
              className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none mb-6"
            />
            <button type="submit" className="w-full bg-blue-500 text-white py-2 rounded hover:bg-blue-600 transition">
              로그인
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Login;
