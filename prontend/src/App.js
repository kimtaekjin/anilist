import "./App.css";
import Navbar from "./Components/Navbar";
import { createBrowserRouter, RouterProvider, Outlet, Navigate } from "react-router-dom";
import Footer from "./Components/Foorter";
import MainPage from "./Page/MainPage/MainPage";
import Trending from "./Page/MainPage/Trending";
import Upcoming from "./Page/MainPage/Upcoming";
import GenreSection from "./Page/MainPage/GenreSection";
import AnimeDetail from "./Page/DetailPage/AnimeDetail";
import Airing from "./Page/MainPage/Airing";

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
        path: "/trending",
        element: <Trending />,
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
        path: "/AnimeDetail",
        element: <AnimeDetail />,
      },
    ],
  },
]);

function App() {
  return <RouterProvider router={route} />;
}

export default App;
