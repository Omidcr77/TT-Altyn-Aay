import type { ReactElement } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/app/AuthContext";
import type { UserRole } from "@/types/auth";

export function RequireRole({ allow, children }: { allow: UserRole[]; children: ReactElement }) {
  const { role } = useAuth();
  if (!role) return <Navigate to="/login" replace />;
  if (!allow.includes(role)) return <Navigate to="/" replace />;
  return children;
}
