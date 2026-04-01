import React from "react";
import { NavLink } from "react-router-dom";
import { items } from "../../../utils/sidebarItems";
import useUiStore from "../../../stores/uiStore";

const SETTINGS_LINKS = new Set(["settings", "help", "logout"]);

const ListItemSettings = () => {
  const isSidebarOpen = useUiStore((state) => state.isSidebarOpen);
  const closeMobileSidebar = useUiStore((state) => state.closeMobileSidebar);
  const expandedContentClass = isSidebarOpen ? "block" : "block lg:hidden";

  return (
    <nav className="w-full flex flex-col gap-2">
      {items
        .filter((item) => SETTINGS_LINKS.has(item.link))
        .map((item) => {
          const Icon = item.icon;

          return (
            <NavLink
              key={item.id}
              to={item.path}
              aria-label={item.name}
              className={({ isActive }) =>
                [
                  "flex items-center transition-colors",
                  isSidebarOpen
                    ? "gap-3 justify-start"
                    : "gap-3 justify-start lg:gap-0 lg:justify-center",
                  "rounded-lg px-4 py-2 hover:bg-accent hover:text-primary",
                  isActive ? "bg-accent text-primary" : "text-white",
                ].join(" ")
              }
              onClick={closeMobileSidebar}
            >
              <Icon size={20} strokeWidth={1.5} />
              <span className={["text-sm font-normal", expandedContentClass].join(" ")}>
                {item.name}
              </span>
            </NavLink>
          );
        })}
    </nav>
  );
};

export default ListItemSettings;
