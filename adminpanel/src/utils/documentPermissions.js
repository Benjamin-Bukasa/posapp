import { hasAnyPermission } from "./permissions";

export const hasScopedDocumentPermission = ({
  user,
  fullPermission,
  ownPermission,
  ownerId,
  status,
  allowedStatuses = [],
}) =>
  hasAnyPermission(user, [fullPermission]) ||
  Boolean(
    ownPermission &&
      hasAnyPermission(user, [ownPermission]) &&
      ownerId &&
      user?.id === ownerId &&
      allowedStatuses.includes(status),
  );
