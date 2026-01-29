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
        path: "/Login",
        element: <Login />,
      },
      {
        path: "/singUp",
        element: <SingUp />,
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
