import { Outlet } from "react-router-dom";
import Navbar from "../components/blocs/navbar/Navbar";
import Sidebar from "../components/blocs/sidebar/Sidebar";

const MainLayout = () => {
  return (
    <section className="fontFamilyPoppins h-screen w-full overflow-hidden bg-background text-text-primary">
      <Sidebar />
      <main className="main min-w-0 overflow-x-hidden overflow-y-auto">
        <Navbar />
        <Outlet />
      </main>
    </section>
  );
};

export default MainLayout;
