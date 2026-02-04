import { createContext, useCallback, useContext, useEffect, useState } from "react";
import axios from "axios";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const API_URL = process.env.REACT_APP_CLIENT_URL;

  const checkAuth = useCallback(async () => {
    try {
      const response = await axios.get(`${API_URL}/user/verify-token`, {
        withCredentials: true,
      });
      setUser(response.data.user || null);
    } catch (error) {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, [API_URL]);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const logout = async () => {
    try {
      const response = await axios.post(`${API_URL}/user/logout`, {}, { withCredentials: true });
      return response.data;
    } catch (error) {
      console.error("로그아웃 실패:", error);
    } finally {
      setUser(null);
    }
  };

  const value = {
    user,
    isLogin: !!user,
    loading,
    checkAuth,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
