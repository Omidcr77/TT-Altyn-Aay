import { apiRequest } from "@/services/http";
import type { RolePermissionsResponse } from "@/types/permissions";

export function fetchRolePermissions() {
  return apiRequest<RolePermissionsResponse>("/api/permissions");
}

export function saveRolePermissions(permissions: Record<string, string[]>) {
  return apiRequest<{ permissions: Record<string, string[]> }>("/api/permissions", "PUT", { permissions });
}
