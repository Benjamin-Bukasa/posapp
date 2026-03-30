import React, { useMemo, useState } from "react";
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
  LogOut
} from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import DropdownAction from "../../ui/dropdownAction";
import useThemeStore from "../../../stores/themeStore";
import useRealtimeStore from "../../../stores/realtimeStore";
import useAuthStore from "../../../stores/authStore";
import useUiStore from "../../../stores/uiStore";
import { formatName } from "../../../utils/formatters";

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

  const scopeItems = [
    { id: "all", label: "Tous" },
    { id: "products", label: "Produits" },
    { id: "categories", label: "Catégories" },
    { id: "clients", label: "Clients" },
  ];

  const sortItems = [
    { id: "relevance", label: "Pertinence" },
    { id: "az", label: "A-Z" },
    { id: "za", label: "Z-A" },
    { id: "recent", label: "Plus récent" },
    { id: "old", label: "Plus ancien" },
  ];
  const realtimeNotifications = useRealtimeStore((state) => state.notifications);
  const realtimeMessages = useRealtimeStore((state) => state.messages);
  const clearNotifications = useRealtimeStore(
    (state) => state.clearNotifications
  );
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

  const breadcrumbMap = {
    dashboard: { label: "Dashboard", path: "/dashboard" },
    products: { label: "Produits", path: "/products" },
    customers: { label: "Clients", path: "/customers" },
    orders: { label: "Commandes", path: "/orders" },
    payments: { label: "Paiements", path: "/payments" },
    reports: { label: "Rapports", path: "/reports" },
    operations: { label: "Operations", path: "/operations" },
    requisitions: { label: "Requisitions", path: "/operations/requisitions" },
    nouvelle: { label: "Nouvelle requisition", path: "/operations/requisitions/nouvelle" },
    transferts: { label: "Transferts", path: "/operations/transferts" },
    livraisons: { label: "Livraisons", path: "/operations/livraisons" },
    receptions: { label: "Receptions", path: "/operations/receptions" },
    inventaire: { label: "Inventaire", path: "/operations/inventaire" },
    sales: { label: "Ventes", path: "/sales" },
    approvisionnement: { label: "Approvisionnement", path: "/reports/approvisionnement" },
    messages: { label: "Messages", path: "/messages" },
    notifications: { label: "Notifications", path: "/notifications" },
    profile: { label: "Profil", path: "/profile" },
    settings: { label: "Paramètres", path: "/settings" },
    help: { label: "Aide", path: "/help" },
  };

  const pathSegments = location.pathname.split("/").filter(Boolean);
  const breadcrumbItems = [
    { label: "Accueil", path: "/" },
    ...(pathSegments.length === 0
      ? [{ label: "Dashboard", path: "/dashboard" }]
      : pathSegments.map((segment, index) => {
          const key = segment.toLowerCase();
          const mapped = breadcrumbMap[key];
          const label = mapped?.label ?? segment.replace(/-/g, " ");
          const path =
            mapped?.path ?? `/${pathSegments.slice(0, index + 1).join("/")}`;
          return { label, path };
        })),
  ];

  return (
    <nav className="sticky top-0 z-[80] border-b border-border bg-surface px-4 py-4 sm:px-6">
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
            <p className="text-xl font-semibold text-text-secondary">
              Bienvenue
            </p>
            <h1 className="truncate text-xl font-semibold text-text-primary">
              {firstName}
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-text-secondary">
            {breadcrumbItems.map((item, index) => {
              const isLast = index === breadcrumbItems.length - 1;
              return (
                <div key={item.path} className="flex min-w-0 items-center gap-2">
                  {isLast ? (
                    <span className="truncate text-text-primary">{item.label}</span>
                  ) : (
                    <Link to={item.path} className="truncate hover:text-text-primary">
                      {item.label}
                    </Link>
                  )}
                  {!isLast ? (
                    <ChevronRight size={14} strokeWidth={1.5} />
                  ) : null}
                </div>
              );
            })}
          </div>
          </div>
        </div>

        <div className="w-full md:max-w-md">
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2">
            <Search size={18} strokeWidth={1.5} className="text-text-secondary" />
            <input
              type="text"
              placeholder={`Rechercher (${searchScope.toLowerCase()})`}
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
                <div
                  className="flex items-center gap-2"
                  title={`Trier: ${searchSort}`}
                >
                  <SlidersHorizontal size={18} strokeWidth={1.5} />
                </div>
              }
              items={sortItems}
              onSelect={(item) => setSearchSort(item.label)}
              buttonClassName="bg-neutral-300 p-2 text-text-primary hover:bg-neutral-400 dark:bg-surface dark:border dark:border-border dark:hover:bg-surface/70"
              menuClassName="min-w-[180px]"
            />
          </div>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar md:gap-3 md:overflow-visible md:pb-0">
          <DropdownAction
            label={
              <div className="relative rounded-lg p-2">
                <Bell size={20} strokeWidth={1.5} />
                {notificationCount > 0 ? (
                  <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-secondary px-1 text-[10px] text-white">
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
                  <p className="text-sm font-semibold text-text-primary">
                    Notifications
                  </p>
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
                    <p className="text-xs text-text-secondary">
                      Aucune notification
                    </p>
                  ) : (
                    notifications.map((item) => (
                      <div
                        key={item.id}
                        className="rounded-lg border border-border bg-surface/80 px-3 py-2"
                      >
                        <p className="text-sm font-medium text-text-primary">
                          {item.title}
                        </p>
                        <p className="text-xs text-text-secondary">
                          {item.message}
                        </p>
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
                  <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-secondary px-1 text-[10px] text-white">
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
                  <p className="text-sm font-semibold text-text-primary">
                    Messages
                  </p>
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
                    <p className="text-xs text-text-secondary">
                      Aucun message
                    </p>
                  ) : (
                    messages.map((item) => (
                      <div
                        key={item.id}
                        className="rounded-lg border border-border bg-surface/80 px-3 py-2"
                      >
                        <p className="text-sm font-medium text-text-primary">
                          {item.title}
                        </p>
                        <p className="text-xs text-text-secondary">
                          {item.message}
                        </p>
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
            aria-label="Changer de thème"
            onClick={toggleTheme}
          >
            {isDark ? (
              <Sun size={20} strokeWidth={1.5} />
            ) : (
              <Moon size={20} strokeWidth={1.5} />
            )}
          </button>

          <DropdownAction
            label={
              <div className="flex items-center gap-4">
                <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-neutral-300 text-text-primary dark:bg-surface dark:border dark:border-border">
                  {avatarUrl ? (
                    <img
                      src={avatarUrl}
                      alt={`Avatar ${fullName}`}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <User size={18} strokeWidth={1.5} />
                  )}
                </div>
                <div className="hidden flex-col items-start leading-tight sm:flex">
                  <span className="text-sm font-semibold text-text-primary">
                    {fullName}
                  </span>
                  <span className="text-xs text-text-secondary">
                    {roleLabel}
                  </span>
                </div>
                <ChevronDown size={16} strokeWidth={1.5} className="hidden sm:block" />
              </div>
            }
            items={[
              { id: "profile", label:<><div className="flex items-center justify-between gap-2"><User size={16} strokeWidth={1.5} /><p>Profil</p></div></>  },
              { id: "settings", label: <><div className="flex items-center justify-between gap-2"><Settings size={16} strokeWidth={1.5} /><p>Paramètres</p></div></> },
              { id: "logout", label: <><div className="flex items-center justify-between gap-2"><LogOut size={16} strokeWidth={1.5} /><p>Déconnexion</p></div></>, variant: "danger" },
            ]}
            onSelect={(item) => {
              if (item.id === "profile") navigate("/profile");
              if (item.id === "settings") navigate("/settings");
              if (item.id === "logout") navigate("/logout");
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
