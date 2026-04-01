import React, { useEffect, useMemo, useState } from "react";
import {
  Bell,
  ChevronDown,
  ChevronRight,
  MessageCircle,
  Menu,
  Moon,
  Search,
  Settings,
  SlidersHorizontal,
  Sun,
  User,
  LogOut,
} from "lucide-react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import DropdownAction from "../../ui/dropdownAction";
import useThemeStore from "../../../stores/themeStore";
import useRealtimeStore from "../../../stores/realtimeStore";
import useAuthStore from "../../../stores/authStore";
import useUiStore from "../../../stores/uiStore";
import { formatName } from "../../../utils/formatters";
import { allRouteMeta, findRouteByPath, getBreadcrumbItems } from "../../../routes/router";

const normalizeSearchText = (value = "") =>
  String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

const scoreSearchItem = (item, query) => {
  const normalizedQuery = normalizeSearchText(query);
  const label = normalizeSearchText(item.name);
  const summary = normalizeSearchText(item.summary);
  const path = normalizeSearchText(item.path);

  if (!normalizedQuery) return 0;
  if (label === normalizedQuery) return 100;
  if (label.startsWith(normalizedQuery)) return 80;
  if (label.includes(normalizedQuery)) return 60;
  if (summary.includes(normalizedQuery)) return 40;
  if (path.includes(normalizedQuery)) return 20;
  return 0;
};

const Navbar = () => {
  const theme = useThemeStore((state) => state.theme);
  const toggleTheme = useThemeStore((state) => state.toggleTheme);
  const isDark = theme === "dark";
  const [searchScope, setSearchScope] = useState("Tous");
  const [searchSort, setSearchSort] = useState("Pertinence");
  const location = useLocation();
  const navigate = useNavigate();
  const openMobileSidebar = useUiStore((state) => state.openMobileSidebar);
  const authUser = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const currentRoute = findRouteByPath(location.pathname);
  const [searchParams] = useSearchParams();
  const [searchValue, setSearchValue] = useState("");

  const scopeItems = [
    { id: "all", label: "Tous" },
    { id: "products", label: "Produits" },
    { id: "categories", label: "Categories" },
    { id: "users", label: "Utilisateurs" },
  ];

  const sortItems = [
    { id: "relevance", label: "Pertinence" },
    { id: "az", label: "A-Z" },
    { id: "za", label: "Z-A" },
    { id: "recent", label: "Plus recent" },
    { id: "old", label: "Plus ancien" },
  ];

  const realtimeNotifications = useRealtimeStore((state) => state.notifications);
  const realtimeMessages = useRealtimeStore((state) => state.messages);
  const clearNotifications = useRealtimeStore((state) => state.clearNotifications);
  const clearMessages = useRealtimeStore((state) => state.clearMessages);
  const notifications = realtimeNotifications;
  const messages = realtimeMessages;
  const notificationCount = notifications.length;
  const messageCount = messages.length;

  const roleLabel = useMemo(() => {
    const role = authUser?.role;
    if (!role) return "Utilisateur";
    if (role === "SUPERADMIN") return "Super admin";
    if (role === "ADMIN") return "Administrateur";
    return "Utilisateur";
  }, [authUser?.role]);

  const fullName = useMemo(() => {
    const name = formatName(authUser);
    if (!name || name === "N/A") return "Utilisateur";
    return name;
  }, [authUser]);

  const firstName = useMemo(() => {
    const rawFirst = authUser?.firstName?.trim();
    if (rawFirst) return rawFirst;
    if (fullName.includes("@")) return "Utilisateur";
    const fallback = fullName.split(" ").filter(Boolean);
    return fallback[0] || "Utilisateur";
  }, [authUser?.firstName, fullName]);

  const avatarUrl = authUser?.avatarUrl || "";
  const breadcrumbItems = getBreadcrumbItems(currentRoute.path);

  useEffect(() => {
    setSearchValue(searchParams.get("q") || "");
  }, [searchParams]);

  const globalSearchResults = useMemo(() => {
    if (normalizeSearchText(searchScope) !== "tous") return [];
    const query = searchValue.trim();
    if (!query) return [];

    const matched = allRouteMeta
      .filter((item) => item?.path && item?.name)
      .map((item, index) => ({
        ...item,
        order: index + 1,
        score: scoreSearchItem(item, query),
      }))
      .filter((item) => item.score > 0);

    if (searchSort === "A-Z") {
      return matched.sort((a, b) => a.name.localeCompare(b.name, "fr"));
    }
    if (searchSort === "Z-A") {
      return matched.sort((a, b) => b.name.localeCompare(a.name, "fr"));
    }
    if (searchSort === "Plus recent") {
      return matched.sort((a, b) => b.order - a.order);
    }
    if (searchSort === "Plus ancien") {
      return matched.sort((a, b) => a.order - b.order);
    }

    return matched.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.order - b.order;
    });
  }, [searchScope, searchSort, searchValue]);

  const resolveSearchTarget = () => {
    const scope = searchScope.toLowerCase();
    if (scope === "produits") return "/configurations/articles/produits";
    if (scope === "categories") return "/configurations/articles/categorie";
    if (scope === "utilisateurs") return "/configurations/utilisateur/liste-utilisateurs";
    return location.pathname;
  };

  const handleSearchSubmit = (event) => {
    event.preventDefault();
    if (normalizeSearchText(searchScope) === "tous") {
      const firstResult = globalSearchResults[0];
      if (firstResult) {
        navigate(firstResult.path);
      }
      return;
    }
    const targetPath = resolveSearchTarget();
    const nextParams = new URLSearchParams();
    if (searchValue.trim()) {
      nextParams.set("q", searchValue.trim());
    }
    navigate(`${targetPath}${nextParams.toString() ? `?${nextParams.toString()}` : ""}`);
  };

  return (
    <nav className="sticky top-0 z-30 border-b border-border bg-surface px-4 py-4 sm:px-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <button
            type="button"
            onClick={openMobileSidebar}
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-border bg-background text-text-primary transition hover:bg-surface lg:hidden"
            aria-label="Ouvrir le menu"
          >
            <Menu size={20} strokeWidth={1.8} />
          </button>

          <div className="min-w-0 flex flex-col gap-1">
            <div className="flex flex-wrap items-baseline gap-2">
              <p className="text-xl font-semibold text-text-secondary">Bienvenue</p>
              <h1 className="truncate text-xl font-semibold text-text-primary">{firstName}</h1>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-text-secondary">
              {breadcrumbItems.map((item, index) => {
                const isLast = index === breadcrumbItems.length - 1;
                return (
                  <div
                    key={`${item.path}-${item.label}`}
                    className="flex min-w-0 items-center gap-2"
                  >
                    {isLast ? (
                      <span className="truncate text-text-primary">{item.label}</span>
                    ) : (
                      <Link to={item.path} className="truncate hover:text-text-primary">
                        {item.label}
                      </Link>
                    )}
                    {!isLast ? <ChevronRight size={14} strokeWidth={1.5} /> : null}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="relative w-full md:max-w-md">
          <form
            onSubmit={handleSearchSubmit}
            className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2"
          >
            <button
              type="submit"
              className="text-text-secondary"
              aria-label="Lancer la recherche"
            >
              <Search size={18} strokeWidth={1.5} />
            </button>
            <input
              type="text"
              placeholder={`Rechercher (${searchScope.toLowerCase()})`}
              value={searchValue}
              onChange={(event) => setSearchValue(event.target.value)}
              className="min-w-0 flex-1 bg-transparent text-sm text-text-primary outline-none"
            />
            <DropdownAction
              label={
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-text-primary">{searchScope}</span>
                  <ChevronDown size={16} strokeWidth={1.5} />
                </div>
              }
              items={scopeItems}
              onSelect={(item) => setSearchScope(item.label)}
              buttonClassName="bg-transparent px-2 py-1 hover:bg-surface/70"
              menuClassName="min-w-[160px]"
            />
            <DropdownAction
              label={
                <div className="flex items-center gap-2" title={`Trier: ${searchSort}`}>
                  <SlidersHorizontal size={18} strokeWidth={1.5} />
                </div>
              }
              items={sortItems}
              onSelect={(item) => setSearchSort(item.label)}
              buttonClassName="bg-background p-2 text-text-primary hover:bg-surface dark:border dark:border-border dark:bg-surface dark:hover:bg-surface/70"
              menuClassName="min-w-[180px]"
            />
          </form>
          {normalizeSearchText(searchScope) === "tous" && searchValue.trim() ? (
            <div className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-20 overflow-hidden rounded-xl border border-border bg-surface shadow-xl">
              {globalSearchResults.length > 0 ? (
                <div className="max-h-80 overflow-y-auto py-2">
                  {globalSearchResults.map((item) => (
                    <button
                      key={`${item.path}-${item.name}`}
                      type="button"
                      onClick={() => navigate(item.path)}
                      className="flex w-full items-start justify-between gap-4 px-4 py-3 text-left transition hover:bg-background"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-text-primary">
                          {item.name}
                        </p>
                        <p className="truncate text-xs text-text-secondary">
                          {item.summary || item.sectionLabel || item.parentLabel || item.path}
                        </p>
                      </div>
                      <span className="shrink-0 text-[11px] text-text-secondary">
                        {item.path}
                      </span>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="px-4 py-3 text-sm text-text-secondary">
                  Aucun resultat.
                </div>
              )}
            </div>
          ) : null}
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar md:gap-3 md:overflow-visible md:pb-0">
          <DropdownAction
            label={
              <div className="relative rounded-lg p-2">
                <Bell size={20} strokeWidth={1.5} />
                {notificationCount > 0 ? (
                  <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-secondary px-1 text-[10px] text-white">
                    {notificationCount}
                  </span>
                ) : null}
              </div>
            }
            buttonClassName="bg-transparent p-0 hover:bg-surface/70"
            menuClassName="w-72"
            menuBodyClassName="p-0"
          >
            {({ closeMenu }) => (
              <div className="w-full">
                <div className="flex items-center justify-between border-b border-border px-4 py-3">
                  <p className="text-sm font-semibold text-text-primary">Notifications</p>
                  <button
                    type="button"
                    onClick={() => {
                      clearNotifications();
                      closeMenu();
                    }}
                    className="text-xs text-secondary hover:underline"
                  >
                    Tout marquer lu
                  </button>
                </div>
                <div className="flex flex-col gap-2 p-3">
                  {notifications.length === 0 ? (
                    <p className="text-xs text-text-secondary">Aucune notification</p>
                  ) : (
                    notifications.map((item) => (
                      <div
                        key={item.id}
                        className="rounded-lg border border-border bg-surface/80 px-3 py-2"
                      >
                        <p className="text-sm font-medium text-text-primary">{item.title}</p>
                        <p className="text-xs text-text-secondary">{item.message}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </DropdownAction>

          <DropdownAction
            label={
              <div className="relative rounded-lg p-2">
                <MessageCircle size={20} strokeWidth={1.5} />
                {messageCount > 0 ? (
                  <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-secondary px-1 text-[10px] text-white">
                    {messageCount}
                  </span>
                ) : null}
              </div>
            }
            buttonClassName="bg-transparent p-0 hover:bg-surface/70"
            menuClassName="w-72"
            menuBodyClassName="p-0"
          >
            {({ closeMenu }) => (
              <div className="w-full">
                <div className="flex items-center justify-between border-b border-border px-4 py-3">
                  <p className="text-sm font-semibold text-text-primary">Messages</p>
                  <button
                    type="button"
                    onClick={() => {
                      clearMessages();
                      closeMenu();
                    }}
                    className="text-xs text-secondary hover:underline"
                  >
                    Tout marquer lu
                  </button>
                </div>
                <div className="flex flex-col gap-2 p-3">
                  {messages.length === 0 ? (
                    <p className="text-xs text-text-secondary">Aucun message</p>
                  ) : (
                    messages.map((item) => (
                      <div
                        key={item.id}
                        className="rounded-lg border border-border bg-surface/80 px-3 py-2"
                      >
                        <p className="text-sm font-medium text-text-primary">{item.title}</p>
                        <p className="text-xs text-text-secondary">{item.message}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </DropdownAction>

          <button
            type="button"
            className="rounded-lg p-2 text-text-primary hover:bg-surface/70"
            aria-label="Changer de theme"
            onClick={toggleTheme}
          >
            {isDark ? <Sun size={20} strokeWidth={1.5} /> : <Moon size={20} strokeWidth={1.5} />}
          </button>

          <DropdownAction
            label={
              <div className="flex items-center gap-4">
                <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-background text-text-primary dark:border dark:border-border dark:bg-surface">
                  {avatarUrl ? (
                    <img src={avatarUrl} alt={`Avatar ${fullName}`} className="h-full w-full object-cover" />
                  ) : (
                    <User size={18} strokeWidth={1.5} />
                  )}
                </div>
                <div className="hidden min-w-0 flex-col items-start leading-tight sm:flex">
                  <span className="text-sm font-semibold text-text-primary">{fullName}</span>
                  <span className="text-xs text-text-secondary">{roleLabel}</span>
                </div>
                <ChevronDown size={16} strokeWidth={1.5} className="hidden sm:block" />
              </div>
            }
            items={[
              {
                id: "profile",
                label: (
                  <div className="flex items-center justify-between gap-2">
                    <User size={16} strokeWidth={1.5} />
                    <p>Profil</p>
                  </div>
                ),
              },
              {
                id: "settings",
                label: (
                  <div className="flex items-center justify-between gap-2">
                    <Settings size={16} strokeWidth={1.5} />
                    <p>Parametres</p>
                  </div>
                ),
              },
              {
                id: "logout",
                label: (
                  <div className="flex items-center justify-between gap-2">
                    <LogOut size={16} strokeWidth={1.5} />
                    <p>Deconnexion</p>
                  </div>
                ),
                variant: "danger",
              },
            ]}
            onSelect={async (item) => {
              if (item.id === "profile") navigate("/configurations/utilisateur/liste-utilisateurs");
              if (item.id === "settings") navigate("/settings");
              if (item.id === "logout") {
                await logout();
                navigate("/login", { replace: true });
              }
            }}
            buttonClassName="bg-transparent p-1 hover:bg-surface/70"
            menuClassName="min-w-[180px]"
          />
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
