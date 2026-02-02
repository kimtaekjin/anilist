import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import loginImage from "../../asset/login.jpg";
import axios from "axios";

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const navigate = useNavigate();

  const API = process.env.NEXT_PUBLIC_API_URL;

  const { checkAuth } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await axios.post(`${API}/user/login`, { email, password }, { withCredentials: true });
      if (response.data) {
        checkAuth();
        alert(response.data.message || "로그인 되었습니다.");
        navigate("/");
      }
    } catch (error) {
      const message = error.response?.data?.message || "로그인에 실패하였습니다.";
      alert(message);
    }
  };

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
          <form onSubmit={handleSubmit}>
            <input
              type="text"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none mb-4"
            />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
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
            <Link to="/singup">
              <p className="text-xs text-gray-400 font-medium cursor-pointer hover:text-blue-300 transition duration-300">
                회원가입
              </p>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
