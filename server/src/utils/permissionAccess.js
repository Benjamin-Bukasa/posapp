const SELLER_DEFAULT_PERMISSION_CODES = Object.freeze([
  "sales.read",
  "sales.create",
  "payments.read",
  "customers.read",
  "customers.create",
  "stock_state.read",
  "movements.read",
  "movements.create",
  "movements.update",
  "movements.delete_own_draft",
  "transfers.read",
  "purchase_requests.read",
  "purchase_requests.create",
  "purchase_requests.update_own_draft",
  "purchase_requests.delete_own_draft",
]);

const normalizePermissionCode = (entry) => {
  if (!entry) return null;
  if (typeof entry === "string") return entry;
  if (typeof entry?.code === "string") return entry.code;
  if (typeof entry?.permission?.code === "string") return entry.permission.code;
  return null;
};

const getGrantedPermissions = (user) => {
  const granted = Array.from(
    new Set(
      (Array.isArray(user?.permissions) ? user.permissions : [])
        .map(normalizePermissionCode)
        .filter(Boolean),
    ),
  );

  if (user?.role === "SELLER" && granted.length === 0) {
    return [...SELLER_DEFAULT_PERMISSION_CODES];
  }

  return granted;
};

const hasPermission = (user, ...codes) => {
  if (!user) return false;
  if (user.role === "SUPERADMIN") return true;

  const granted = getGrantedPermissions(user);
  if (user.role === "ADMIN" && granted.length === 0) {
    return true;
  }

  return codes.some((code) => granted.includes(code));
};

const hasAnyPermission = (user, codes = []) => hasPermission(user, ...codes);

module.exports = {
  SELLER_DEFAULT_PERMISSION_CODES,
  getGrantedPermissions,
  hasPermission,
  hasAnyPermission,
};
