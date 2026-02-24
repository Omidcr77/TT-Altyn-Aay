import { apiRequest } from "@/services/http";
import type { MasterCategory, MasterDataItem } from "@/types/masterData";

export function fetchMasterData() {
  return apiRequest<MasterDataItem[]>("/api/master-data");
}

export interface MasterDataPayload {
  category: MasterCategory;
  value: string;
  active: boolean;
}

export function createMasterData(payload: MasterDataPayload) {
  return apiRequest<MasterDataItem>("/api/master-data", "POST", payload);
}

export function updateMasterData(id: number, payload: MasterDataPayload) {
  return apiRequest<MasterDataItem>(`/api/master-data/${id}`, "PUT", payload);
}

export function deleteMasterData(id: number) {
  return apiRequest<{ deleted_id: number }>(`/api/master-data/${id}`, "DELETE");
}

export interface SystemSettingItem {
  key: string;
  value: string;
}

export function fetchSystemSettings() {
  return apiRequest<SystemSettingItem[]>("/api/master-data/settings/system");
}

export function upsertSystemSetting(key: string, value: string) {
  return apiRequest<SystemSettingItem>("/api/master-data/settings/system", "POST", { key, value });
}
