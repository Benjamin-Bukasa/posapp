import React, { useEffect } from "react";
import Logo from "./Logo";
import useUiStore from "../../../stores/uiStore";
import ListItemAdmin from "./ListItemAdmin";

const Sidebar = () => {
  const isSidebarOpen = useUiStore((state) => state.isSidebarOpen);
  const isMobileSidebarOpen = useUiStore((state) => state.isMobileSidebarOpen);
  const closeMobileSidebar = useUiStore((state) => state.closeMobileSidebar);

  useEffect(() => {
    const syncViewport = () => {
      if (window.innerWidth >= 1280) {
        closeMobileSidebar();
      }
    };

    syncViewport();
    window.addEventListener("resize", syncViewport);
    return () => window.removeEventListener("resize", syncViewport);
  }, [closeMobileSidebar]);

  return (
    <>
      <button
        type="button"
        aria-label="Fermer le menu"
        onClick={closeMobileSidebar}
        className={[
          "fixed inset-0 z-[89] bg-slate-950/45 backdrop-blur-[1px] transition-opacity xl:hidden",
          isMobileSidebarOpen ? "opacity-100" : "pointer-events-none opacity-0",
        ].join(" ")}
      />

      <aside
        className={[
          "sidebar fixed inset-y-0 left-0 z-[90] h-screen max-w-[88vw] overflow-hidden shadow-2xl transition-transform duration-200 xl:static xl:z-auto xl:h-full xl:max-w-none xl:translate-x-0 xl:shadow-none",
          isMobileSidebarOpen ? "translate-x-0" : "-translate-x-full",
          "w-80",
          isSidebarOpen ? "xl:w-80" : "xl:w-[88px]",
        ].join(" ")}
      >
        <div className="flex h-full min-h-0 w-full flex-col">
          <div className="sticky top-0 z-10 w-full shrink-0 bg-secondary px-4 py-5 dark:bg-primary">
            <div className="flex w-full items-center justify-between">
              <Logo />
            </div>
          </div>

          <div className="sidebar-scroll min-h-0 flex-1 overflow-y-auto px-2 pb-4">
            <div className="w-full">
              <ListItemAdmin />
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
