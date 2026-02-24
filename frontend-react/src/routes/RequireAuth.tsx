import type { ReactElement } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/app/AuthContext";
import { LoadingScreen } from "@/components/LoadingScreen";

export function RequireAuth({ children }: { children: ReactElement }) {
  const { loading, isAuthenticated } = useAuth();
  const location = useLocation();

  if (loading) return <LoadingScreen message="در حال بررسی نشست..." />;
  if (!isAuthenticated) return <Navigate to="/login" replace state={{ from: location }} />;
  return children;
}
