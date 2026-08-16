import "./App.css";
import { lazy, Suspense } from "react";
import Navbar from "./Components/Navbar/Navbar";
import { createBrowserRouter, RouterProvider, Outlet } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import Footer from "./Components/Footer/Foorter";

const MainPage = lazy(() => import("./Page/MainPage/MainPage"));
const Upcoming = lazy(() => import("./Page/MainPage/Upcoming"));
const GenreSection = lazy(() => import("./Page/MainPage/GenreSection"));
const AnimeDetail = lazy(() => import("./Page/DetailPage/AnimeDetail"));
const Airing = lazy(() => import("./Page/MainPage/Airing"));
const Login = lazy(() => import("./Page/Login/Login"));
const SingUp = lazy(() => import("./Page/Login/SingUp"));
const Board = lazy(() => import("./Page/BoardPage/BoardPage"));
const BoardCreatePost = lazy(() => import("./Page/BoardPage/BoardCreatePost"));
const PostDetailPage = lazy(() => import("./Page/BoardPage/PostDetailPage"));
const PasswordForgot = lazy(() => import("./Page/Login/Password/Forgot"));
const ResetPassword = lazy(() => import("./Page/Login/Password/reset"));

function Layout() {
  return (
    <>
      <Navbar />
      <main className="min-h-screen pt-20 text-stone-100">
        <Suspense fallback={<p className="py-20 text-center text-stone-300">페이지를 불러오는 중입니다.</p>}>
          <Outlet />
        </Suspense>
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
