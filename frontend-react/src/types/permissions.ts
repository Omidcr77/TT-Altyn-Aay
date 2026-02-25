export interface RolePermissionsResponse {
  permissions: Record<string, string[]>;
  available: string[];
}
