import { apiRequest } from "@/services/http";

export interface DashboardStats {
  total_today: number;
  total_week: number;
  pending: number;
  done: number;
  by_type: Array<{ name: string; count: number }>;
  by_staff: Array<{ name: string; count: number }>;
  recent: Array<{ id: number; customer_name: string; activity_type: string; status: "pending" | "done"; date: string }>;
}

export interface DashboardTrendItem {
  date: string;
  created: number;
  done: number;
  pending_delta: number;
}

export interface DashboardTrends {
  days: number;
  items: DashboardTrendItem[];
}

export function fetchDashboardStats() {
  return apiRequest<DashboardStats>("/api/dashboard/stats");
}

export function fetchDashboardTrends(days = 30) {
  return apiRequest<DashboardTrends>(`/api/dashboard/trends?days=${days}`);
}
