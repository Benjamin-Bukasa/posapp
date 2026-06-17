export const isPermissionDeniedError = (error) => Number(error?.status) === 403;

export const shouldSkipPermissionToast = (error) =>
  isPermissionDeniedError(error);
