import { apiRequest } from "@/services/http";
import type { ActivitiesResponse, Activity, ActivityCreatePayload, ActivityUpdatePayload } from "@/types/activity";

export interface ActivityFilters {
  page: number;
  pageSize: number;
  status: "pending" | "done";
  search?: string;
  dateFrom?: string;
  dateTo?: string;
  staffId?: string;
  customer?: string;
}

function toQuery(filters: ActivityFilters) {
  const p = new URLSearchParams();
  p.set("page", String(filters.page));
  p.set("page_size", String(filters.pageSize));
  p.set("status", filters.status);
  if (filters.search?.trim()) p.set("search", filters.search.trim());
  if (filters.dateFrom) p.set("date_from", filters.dateFrom);
  if (filters.dateTo) p.set("date_to", filters.dateTo);
  if (filters.staffId) p.set("staff_id", filters.staffId);
  if (filters.customer?.trim()) p.set("customer", filters.customer.trim());
  return p.toString();
}

export function fetchActivities(filters: ActivityFilters) {
  return apiRequest<ActivitiesResponse>(`/api/activities?${toQuery(filters)}`);
}

export function fetchActivity(id: number) {
  return apiRequest<Activity>(`/api/activities/${id}`);
}

export function markDone(id: number) {
  return apiRequest<{ id: number; status: "done" }>(`/api/activities/${id}/mark-done`, "POST", {});
}

export function deleteActivity(id: number) {
  return apiRequest<{ deleted_id: number }>(`/api/activities/${id}`, "DELETE");
}

export function updateActivity(id: number, payload: ActivityUpdatePayload) {
  return apiRequest<Activity>(`/api/activities/${id}`, "PUT", payload);
}

export function createActivity(payload: ActivityCreatePayload) {
  return apiRequest<Activity>("/api/activities", "POST", payload);
}

export function bulkActivityAction(payload: Record<string, unknown>) {
  return apiRequest<{
    action: string;
    total: number;
    updated: number;
    deleted: number;
    touched_ids: number[];
  }>("/api/activities/bulk", "POST", payload);
}
