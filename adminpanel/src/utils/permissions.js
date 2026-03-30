export const hasAnyPermission = (user, permissions = []) => {
  if (!permissions || !permissions.length) return true;
  if (user?.role === "SUPERADMIN") return true;

  const granted = Array.isArray(user?.permissions) ? user.permissions : [];
  if (user?.role === "ADMIN" && granted.length === 0) {
    return true;
  }

  return permissions.some((permission) => granted.includes(permission));
};

export const hasAllPermissions = (user, permissions = []) => {
  if (!permissions || !permissions.length) return true;
  if (user?.role === "SUPERADMIN") return true;

  const granted = Array.isArray(user?.permissions) ? user.permissions : [];
  if (user?.role === "ADMIN" && granted.length === 0) {
    return true;
  }

  return permissions.every((permission) => granted.includes(permission));
};
