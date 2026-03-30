import React, { useEffect, useMemo, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { ChevronDown } from "lucide-react";
import {
  getRouteRequiredPermissions,
  sidebarSections,
} from "../../../routes/router";
import useUiStore from "../../../stores/uiStore";
import useAuthStore from "../../../stores/authStore";
import { hasAnyPermission } from "../../../utils/permissions";

const ListItemAdmin = () => {
  const isSidebarOpen = useUiStore((state) => state.isSidebarOpen);
  const closeMobileSidebar = useUiStore((state) => state.closeMobileSidebar);
  const user = useAuthStore((state) => state.user);
  const location = useLocation();
  const [openGroups, setOpenGroups] = useState({});
  const navSections = useMemo(
    () =>
      sidebarSections
        .map((section) => ({
          ...section,
          items: section.items
            .map((item) => {
              if (item.children?.length) {
                const children = item.children.filter((child) =>
                  hasAnyPermission(
                    user,
                    child.requiredPermissions ||
                      getRouteRequiredPermissions(child.path),
                  ),
                );
                return children.length ? { ...item, children } : null;
              }

              return hasAnyPermission(
                user,
                item.requiredPermissions || getRouteRequiredPermissions(item.path),
              )
                ? item
                : null;
            })
            .filter(Boolean),
        }))
        .filter((section) => section.items.length),
    [user],
  );
  const expandedContentClass = isSidebarOpen ? "block" : "block lg:hidden";
  const expandedFlexClass = isSidebarOpen ? "" : "lg:hidden";

  const isPathActive = (path) => {
    if (!path) return false;
    if (path === "/") return location.pathname === "/";
    return location.pathname === path || location.pathname.startsWith(`${path}/`);
  };

  useEffect(() => {
    setOpenGroups((prev) => {
      const next = { ...prev };
      navSections.forEach((section) => {
        section.items.forEach((item) => {
          if (!item.children?.length) return;
          const hasActiveChild = item.children.some((child) => isPathActive(child.path));
          if (hasActiveChild && next[item.link] === undefined) next[item.link] = true;
        });
      });
      return next;
    });
  }, [location.pathname, navSections]);

  return (
    <div className="flex w-full flex-col gap-5">
      {navSections.map((section) => (
        <div key={section.id} className="flex flex-col gap-2">
          <p
            className={[
              "px-4 text-xs uppercase tracking-[0.18em] text-white/45",
              expandedContentClass,
            ].join(" ")}
          >
            {section.title}
          </p>

          <nav className="flex w-full flex-col gap-2">
            {section.items.map((item) => {
              const Icon = item.icon;

              if (item.children?.length) {
                const isActiveGroup = item.children.some((child) => isPathActive(child.path));
                const isOpen = openGroups[item.link] ?? isActiveGroup;

                return (
                  <div key={item.id} className="flex flex-col gap-1">
                    <button
                      type="button"
                      aria-label={item.name}
                      aria-expanded={isOpen}
                      onClick={() =>
                        setOpenGroups((prev) => ({
                          ...prev,
                          [item.link]: !prev[item.link],
                        }))
                      }
                      className={[
                        "flex w-full items-center transition-colors",
                        isSidebarOpen ? "justify-between" : "justify-between lg:justify-center",
                        "rounded-lg px-4 py-2 hover:bg-accent hover:text-primary",
                        isActiveGroup ? "bg-accent text-primary" : "text-white",
                      ].join(" ")}
                    >
                      <span
                        className={[
                          "flex items-center",
                          isSidebarOpen ? "gap-3" : "gap-3 lg:gap-2",
                        ].join(" ")}
                      >
                        <Icon size={20} strokeWidth={1.5} />
                        <span className={["text-sm font-normal", expandedContentClass].join(" ")}>
                          {item.name}
                        </span>
                      </span>
                      <ChevronDown
                        size={16}
                        strokeWidth={1.5}
                        className={[
                          "transition-transform",
                          expandedFlexClass,
                          isOpen ? "rotate-180" : "",
                        ].join(" ")}
                      />
                    </button>

                    {isOpen ? (
                      <div className={["flex flex-col gap-1 pl-6", expandedFlexClass].join(" ")}>
                        {item.children.map((child) => {
                          const ChildIcon = child.icon;
                          return (
                            <NavLink
                              key={child.id || child.link}
                              to={child.path}
                              aria-label={child.name}
                              className={({ isActive }) =>
                                [
                                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                                  "hover:bg-accent hover:text-primary",
                                  isActive ? "bg-accent text-primary" : "text-white",
                                ].join(" ")
                              }
                              onClick={closeMobileSidebar}
                            >
                              {ChildIcon ? <ChildIcon size={18} strokeWidth={1.5} /> : null}
                              <span>{child.name}</span>
                            </NavLink>
                          );
                        })}
                      </div>
                    ) : null}
                  </div>
                );
              }

              return (
                <NavLink
                  key={item.id}
                  to={item.path}
                  aria-label={item.name}
                  className={({ isActive }) =>
                    [
                      "flex items-center transition-colors",
                      isSidebarOpen
                        ? "justify-start gap-3"
                        : "justify-start gap-3 lg:justify-center lg:gap-2",
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
        </div>
      ))}
    </div>
  );
};

export default ListItemAdmin;
