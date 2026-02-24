import { apiRequest } from "@/services/http";
import type { StaffRef } from "@/types/activity";

export function fetchStaff() {
  return apiRequest<StaffRef[]>("/api/staff");
}

export interface StaffPayload {
  name: string;
  phone?: string | null;
  active: boolean;
}

export function createStaff(payload: StaffPayload) {
  return apiRequest<StaffRef>("/api/staff", "POST", payload);
}

export function updateStaff(id: number, payload: StaffPayload) {
  return apiRequest<StaffRef>(`/api/staff/${id}`, "PUT", payload);
}

export function deleteStaff(id: number) {
  return apiRequest<{ deleted_id: number }>(`/api/staff/${id}`, "DELETE");
}
