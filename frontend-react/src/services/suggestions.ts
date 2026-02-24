import { apiRequest } from "@/services/http";

export type SuggestionField = "customer_name" | "address" | "staff";

export function fetchSuggestions(field: SuggestionField, q: string) {
  const params = new URLSearchParams({ field, q });
  return apiRequest<string[]>(`/api/suggestions?${params.toString()}`);
}
