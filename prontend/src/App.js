import "./App.css";
import Navbar from "./Components/Navbar";
import MainPage from "./Page/MainPage";
import { createBrowserRouter, RouterProvider, Outlet, Navigate } from "react-router-dom";
import Trending from "./Page/Trending";
import Footer from "./Components/Foorter";
import Airing from "./Page/Airing";
import Upcoming from "./Page/Upcoming";

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
    ],
  },
]);

function App() {
  return <RouterProvider router={route} />;
}

export default App;
