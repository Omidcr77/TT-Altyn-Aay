import { apiRequest } from "@/services/http";
import type { NotificationPayload } from "@/types/notification";

export function fetchNotifications(unreadOnly = false) {
  const q = unreadOnly ? "?unread_only=true" : "";
  return apiRequest<NotificationPayload>(`/api/notifications${q}`);
}

export function markNotificationRead(id: number) {
  return apiRequest<{ id: number }>(`/api/notifications/${id}/read`, "POST", {});
}

export interface NotificationRules {
  overdue_enabled: boolean;
  unassigned_enabled: boolean;
  high_priority_enabled: boolean;
  high_priority_threshold: number;
  overdue_days: number;
}

export function fetchNotificationRules() {
  return apiRequest<NotificationRules>("/api/notifications/rules");
}

export function saveNotificationRules(payload: Partial<NotificationRules>) {
  return apiRequest<{ saved: boolean }>("/api/notifications/rules", "POST", payload);
}

export function runNotificationRules() {
  return apiRequest<Record<string, unknown>>("/api/notifications/rules/run", "POST", {});
}
