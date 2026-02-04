import "./App.css";
import Navbar from "./Components/Navbar/Navbar";
import { createBrowserRouter, RouterProvider, Outlet } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import Footer from "./Components/Footer/Foorter";
import MainPage from "./Page/MainPage/MainPage";
import Upcoming from "./Page/MainPage/Upcoming";
import GenreSection from "./Page/MainPage/GenreSection";
import AnimeDetail from "./Page/DetailPage/AnimeDetail";
import Airing from "./Page/MainPage/Airing";
import Login from "./Page/Login/Login";
import SingUp from "./Page/Login/SingUp";
import Board from "./Page/BoardPage/BoardPage";
import BoardCreatePost from "./Page/BoardPage/BoardCreatePost";
import PostDetailPage from "./Page/BoardPage/PostDetailPage";
import PasswordForgot from "./Page/Login/Password/Forgot";
import ResetPassword from "./Page/Login/Password/reset";

function Layout() {
  return (
    <>
      <Navbar />
      <main className="pt-20">
        <Outlet />
      </main>
      <Footer />
    </>
  );
}

const route = createBrowserRouter([
  {
    path: "/",
    element: <Layout />,
    children: [
      {
        index: true,
        element: <MainPage />,
      },
      {
        path: "/Airing",
        element: <Airing />,
      },
      {
        path: "/Upcoming",
        element: <Upcoming />,
      },
      {
        path: "/Genre",
        element: <GenreSection />,
      },
      {
        path: "/AnimeDetail/:id",
        element: <AnimeDetail />,
      },
      {
        path: "/user/Login",
        element: <Login />,
      },
      {
        path: "/user/singUp",
        element: <SingUp />,
      },
      {
        path: "/user/find",
        element: <PasswordForgot />, //비밀번호 찾기
      },
      {
        path: "/user/reset-password",
        element: <ResetPassword />, //비밀번호 찾기
      },
      {
        path: "/board",
        element: <Board />,
      },
      {
        path: "/board/posts",
        element: <BoardCreatePost />,
      },
      {
        path: "/board/edit/:id",
        element: <BoardCreatePost />, //수정모드
      },
      {
        path: "/board/posts/:id",
        element: <PostDetailPage />,
      },
    ],
  },
]);

function App() {
  return (
    <AuthProvider>
      <RouterProvider router={route} />
    </AuthProvider>
  );
}

export default App;
