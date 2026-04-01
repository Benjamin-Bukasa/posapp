import { useEffect } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { initRealtimeListeners } from "../services/realtimeListeners";
import useAuthStore from "../stores/authStore";

const ProtectedRoute = () => {
  const location = useLocation();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  useEffect(() => {
    if (isAuthenticated) {
      initRealtimeListeners();
    }
  }, [isAuthenticated]);

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <Outlet />;
};

export default ProtectedRoute;
