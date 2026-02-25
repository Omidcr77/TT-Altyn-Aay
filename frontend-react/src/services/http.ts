import type { AuthPayload } from "@/types/auth";
import { clearStoredAuth, getStoredAuth, setStoredAuth } from "./authStorage";

const API_BASE = "";

type HttpMethod = "GET" | "POST" | "PUT" | "DELETE";

interface ApiEnvelope<T> {
  success: boolean;
  data: T;
  error?: { message?: string };
}

async function refreshToken(refreshToken: string): Promise<string | null> {
  try {
    const res = await fetch("/api/auth/refresh", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken })
    });
    const parsed = (await res.json().catch(() => null)) as ApiEnvelope<{ access_token: string }> | null;
    if (!res.ok || !parsed?.success || !parsed?.data?.access_token) return null;
    const current = getStoredAuth();
    if (!current) return null;
    setStoredAuth({ ...current, access_token: parsed.data.access_token });
    return parsed.data.access_token;
  } catch {
    return null;
  }
}

export async function apiRawRequest(path: string, init: RequestInit = {}): Promise<Response> {
  const auth = getStoredAuth();
  const headers = new Headers(init.headers || {});
  if (auth?.access_token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${auth.access_token}`);
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers
  });

  if (response.status === 401 && auth?.refresh_token) {
    const nextAccess = await refreshToken(auth.refresh_token);
    if (nextAccess) {
      headers.set("Authorization", `Bearer ${nextAccess}`);
      const retry = await fetch(`${API_BASE}${path}`, { ...init, headers });
      if (retry.status === 401) {
        clearStoredAuth();
        throw new Error("نشست شما منقضی شده است");
      }
      return retry;
    }
    clearStoredAuth();
    throw new Error("نشست شما منقضی شده است");
  }

  return response;
}

export async function apiRequest<T>(path: string, method: HttpMethod = "GET", body?: unknown): Promise<T> {
  const res = await apiRawRequest(path, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body !== undefined ? JSON.stringify(body) : undefined
  });

  const parsed = (await res.json().catch(() => null)) as ApiEnvelope<T> | null;
  if (!res.ok || !parsed?.success) {
    throw new Error(parsed?.error?.message || "درخواست ناموفق بود");
  }
  return parsed.data;
}

export function loginRequest(username: string, password: string) {
  return apiRequest<AuthPayload>("/api/auth/login", "POST", { username, password });
}

export function changePasswordRequest(currentPassword: string, newPassword: string) {
  return apiRequest<{ changed: boolean }>("/api/auth/change-password", "POST", {
    current_password: currentPassword,
    new_password: newPassword
  });
}
