import { Navigate, Outlet, useLocation } from "react-router-dom";
import useAuthStore from "../stores/authStore";

const ProtectedRoute = () => {
  const location = useLocation();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const isInitialized = useAuthStore((state) => state.isInitialized);

  if (!isInitialized) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background font-poppins text-text-primary">
        <div className="rounded-2xl border border-border bg-surface px-6 py-4 shadow-sm">
          Verification de la session...
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <Outlet />;
};

export default ProtectedRoute;
