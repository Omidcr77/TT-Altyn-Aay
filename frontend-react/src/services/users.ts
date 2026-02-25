import { apiRequest } from "./http";
import type { AppUser, AppUserOption, CreateUserPayload, UpdateUserPayload } from "@/types/user";

export function fetchUsers() {
  return apiRequest<AppUser[]>("/api/users");
}

export function fetchUserOptions() {
  return apiRequest<AppUserOption[]>("/api/users/options");
}

export function createUser(payload: CreateUserPayload) {
  return apiRequest<AppUser>("/api/users", "POST", payload);
}

export function updateUser(userId: number, payload: UpdateUserPayload) {
  return apiRequest<AppUser>(`/api/users/${userId}`, "PUT", payload);
}

export function deleteUser(userId: number) {
  return apiRequest<{ deleted_id: number }>(`/api/users/${userId}`, "DELETE");
}
