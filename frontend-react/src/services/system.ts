import { apiRequest } from "@/services/http";
import type { BackupItem } from "@/types/system";

export function fetchBackups() {
  return apiRequest<BackupItem[]>("/api/system/backups");
}

export function createBackup() {
  return apiRequest<{ created: string; retention_deleted: number }>("/api/system/backups", "POST", {});
}

export function restoreBackup(file: string) {
  return apiRequest<{ restored: string }>("/api/system/backups/restore", "POST", { file });
}
