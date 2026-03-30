const hasPermission = (user, ...codes) => {
  if (!user) return false;
  if (user.role === "SUPERADMIN") return true;

  const granted = Array.isArray(user.permissions) ? user.permissions : [];
  if (user.role === "ADMIN" && granted.length === 0) {
    return true;
  }

  return codes.some((code) => granted.includes(code));
};

const hasAnyPermission = (user, codes = []) => hasPermission(user, ...codes);

module.exports = {
  hasPermission,
  hasAnyPermission,
};
