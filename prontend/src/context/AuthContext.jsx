import { createContext, useContext, useEffect, useState } from "react";
import axios from "axios";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [isLogin, setIsLogin] = useState(false);
  const [user, setUser] = useState(null);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await axios.get("http://localhost:3000/user/verify-token", {
          withCredentials: true,
        });

        if (response.data.user) {
          setUser(response.data.user);
          setIsLogin(true);
          console.log("정보확인:", response.data.user);
        }
      } catch (error) {
        setUser(null);
        setIsLogin(false);
      }
    };

    checkAuth();
  }, []);

  const login = (userData) => {
    setUser(userData);
    setIsLogin(true);
  };

  // 로그아웃 처리
  const logout = async () => {
    setUser(null);
    setIsLogin(false);
  };

  return <AuthContext.Provider value={{ isLogin, user, login, logout }}>{children}</AuthContext.Provider>;
};

export const useAuth = () => useContext(AuthContext);
