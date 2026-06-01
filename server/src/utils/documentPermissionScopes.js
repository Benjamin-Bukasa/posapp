const { hasPermission } = require("./permissionAccess");

const hasOwnPermissionForStatuses = ({
  user,
  ownerId,
  status,
  ownPermission,
  allowedStatuses = [],
}) =>
  Boolean(
    ownPermission &&
      hasPermission(user, ownPermission) &&
      ownerId &&
      user?.id === ownerId &&
      allowedStatuses.includes(status),
  );

const hasScopedPermission = ({
  user,
  fullPermission,
  ownPermission,
  ownerId,
  status,
  allowedStatuses = [],
}) =>
  hasPermission(user, fullPermission) ||
  hasOwnPermissionForStatuses({
    user,
    ownerId,
    status,
    ownPermission,
    allowedStatuses,
  });

module.exports = {
  hasOwnPermissionForStatuses,
  hasScopedPermission,
};
