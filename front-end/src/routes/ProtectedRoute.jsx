import { useEffect } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { initRealtimeListeners } from "../services/realtimeListeners";
import useAuthStore from "../stores/authStore";
import { canAccessPath } from "../utils/routePermissions";

const ProtectedRoute = () => {
  const location = useLocation();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const user = useAuthStore((state) => state.user);

  useEffect(() => {
    if (isAuthenticated) {
      initRealtimeListeners();
    }
  }, [isAuthenticated]);

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (!canAccessPath(user, location.pathname)) {
    return <Navigate to="/dashboard" replace state={{ deniedFrom: location }} />;
  }

  return <Outlet />;
};

export default ProtectedRoute;
