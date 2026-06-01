import { hasAnyPermission } from "./permissions";

const PATH_PERMISSION_RULES = [
  { prefix: "/counter", permissions: ["sales.create"] },
  { prefix: "/orders", permissions: ["sales.read"] },
  { prefix: "/sales", permissions: ["sales.read"] },
  { prefix: "/payments", permissions: ["payments.read"] },
];

const LINK_PERMISSION_MAP = {
  counter: ["sales.create"],
  orders: ["sales.read"],
  sales: ["sales.read"],
  payments: ["payments.read"],
};

export const getRequiredPermissionsForPath = (pathname = "") => {
  const normalizedPath = String(pathname || "").trim();
  const match = PATH_PERMISSION_RULES.find(
    (rule) =>
      normalizedPath === rule.prefix || normalizedPath.startsWith(`${rule.prefix}/`),
  );
  return match?.permissions || [];
};

export const canAccessPath = (user, pathname = "") =>
  hasAnyPermission(user, getRequiredPermissionsForPath(pathname));

export const getRequiredPermissionsForLink = (link) =>
  LINK_PERMISSION_MAP[String(link || "").trim()] || [];

export const canAccessSidebarItem = (user, item) => {
  if (!item) return false;

  if (Array.isArray(item.children) && item.children.length) {
    return item.children.some((child) => canAccessSidebarItem(user, child));
  }

  const linkPermissions = getRequiredPermissionsForLink(item.link || item.id);
  const requiredPermissions = linkPermissions.length
    ? linkPermissions
    : getRequiredPermissionsForPath(item.path);

  return hasAnyPermission(user, requiredPermissions);
};

export const filterSidebarChildren = (user, children = []) =>
  (Array.isArray(children) ? children : []).filter((child) =>
    canAccessSidebarItem(user, child),
  );
