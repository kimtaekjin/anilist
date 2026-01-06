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
        <div className="bg-gray-50 p-8 w-80 max-w-md flex flex-col justify-center" style={{ height: "400px" }}>
          <h3 className="text-2xl font-bold mb-10 text-center text-gray-500">Login</h3>
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
            <div className="flex justify-center">
              <button type="submit" className="w-1/2 bg-blue-400 text-white py-2 rounded hover:bg-blue-500 transition">
                로그인
              </button>
            </div>
          </form>
          <div className="flex justify-center mt-5 ">
            <p className="text-xs text-gray-400 font-medium cursor-pointer hover:text-blue-300 transition duration-300">
              비밀번호를 잃어버리셨나요?
            </p>
          </div>

          <div className="flex justify-center mt-3">
            <p className="text-xs text-gray-400 font-medium cursor-pointer hover:text-blue-300 transition duration-300">
              회원가입
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
