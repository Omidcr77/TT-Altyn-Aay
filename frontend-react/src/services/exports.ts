import { apiRawRequest } from "@/services/http";
import type { ExcelImportResult, ExcelValidateResult } from "@/types/export";

interface ApiEnvelope<T> {
  success: boolean;
  data: T;
  error?: { message?: string };
}

async function readEnvelope<T>(response: Response): Promise<T> {
  const payload = (await response.json().catch(() => null)) as ApiEnvelope<T> | null;
  if (!response.ok || !payload?.success) {
    throw new Error(payload?.error?.message || "درخواست ناموفق بود");
  }
  return payload.data;
}

async function downloadFile(path: string, fallbackName: string) {
  const response = await apiRawRequest(path, { method: "GET" });
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as ApiEnvelope<unknown> | null;
    throw new Error(payload?.error?.message || "دانلود فایل ناموفق بود");
  }
  const blob = await response.blob();
  const contentDisposition = response.headers.get("content-disposition") || "";
  const match = /filename=\"?([^\";]+)\"?/i.exec(contentDisposition);
  const fileName = match?.[1] || fallbackName;

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

export function downloadCsv() {
  return downloadFile("/api/exports/csv", "activities.csv");
}

export function downloadExcel() {
  return downloadFile("/api/exports/excel", "activities-export.xlsx");
}

export function downloadExcelTemplate() {
  return downloadFile("/api/exports/excel/template", "activities-import-template.xlsx");
}

export async function validateExcelImport(file: File) {
  const formData = new FormData();
  formData.append("file", file);
  const response = await apiRawRequest("/api/exports/excel/validate", {
    method: "POST",
    body: formData
  });
  return readEnvelope<ExcelValidateResult>(response);
}

export async function importExcel(file: File, mode: "insert" | "upsert") {
  const formData = new FormData();
  formData.append("file", file);
  const response = await apiRawRequest(`/api/exports/excel/import?mode=${mode}`, {
    method: "POST",
    body: formData
  });
  return readEnvelope<ExcelImportResult>(response);
}
