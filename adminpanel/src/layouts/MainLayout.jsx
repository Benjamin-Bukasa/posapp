import { useEffect } from "react";
import { Outlet } from "react-router-dom";
import Navbar from "../components/blocs/navbar/Navbar";
import Sidebar from "../components/blocs/sidebar/Sidebar";
import IosInstallHint from "../components/ui/IosInstallHint";
import useUiStore from "../stores/uiStore";

const detectTabletSidebarMode = () => {
  if (typeof window === "undefined") return false;

  const width = window.innerWidth;
  const platform = window.navigator?.platform || "";
  const userAgent = window.navigator?.userAgent || "";
  const maxTouchPoints = Number(window.navigator?.maxTouchPoints || 0);

  const isTabletDevice =
    /iPad|Tablet/i.test(platform) ||
    /iPad|Tablet/i.test(userAgent) ||
    /Android(?!.*Mobile)/i.test(userAgent) ||
    (/Mac/.test(platform) && maxTouchPoints > 1);

  return isTabletDevice && width >= 768 && width <= 1366;
};

const MainLayout = () => {
  const setTabletSidebarMode = useUiStore((state) => state.setTabletSidebarMode);
  const closeMobileSidebar = useUiStore((state) => state.closeMobileSidebar);

  useEffect(() => {
    const syncViewportMode = () => {
      const isTabletMode = detectTabletSidebarMode();
      setTabletSidebarMode(isTabletMode);

      if (!isTabletMode && window.innerWidth >= 1024) {
        closeMobileSidebar();
      }
    };

    syncViewportMode();
    window.addEventListener("resize", syncViewportMode);
    window.addEventListener("orientationchange", syncViewportMode);

    return () => {
      window.removeEventListener("resize", syncViewportMode);
      window.removeEventListener("orientationchange", syncViewportMode);
    };
  }, [closeMobileSidebar, setTabletSidebarMode]);

  return (
    <section className="fontFamilyPoppins h-screen w-full overflow-hidden bg-background text-text-primary">
      <Sidebar />
      <main className="main min-w-0 overflow-x-hidden overflow-y-auto">
        <IosInstallHint />
        <Navbar />
        <Outlet />
      </main>
    </section>
  );
};

export default MainLayout;
