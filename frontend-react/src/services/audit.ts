import { apiRequest } from "@/services/http";
import type { AuditListPayload, AuditUndoPayload } from "@/types/audit";

export function fetchAuditLogs(page: number, pageSize: number) {
  const params = new URLSearchParams({
    page: String(page),
    page_size: String(pageSize)
  });
  return apiRequest<AuditListPayload>(`/api/audit?${params.toString()}`);
}

export function undoAudit(auditId: number) {
  return apiRequest<AuditUndoPayload>(`/api/audit/${auditId}/undo`, "POST", {});
}
