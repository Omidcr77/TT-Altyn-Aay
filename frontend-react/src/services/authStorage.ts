import type { AuthPayload } from "@/types/auth";

const AUTH_KEY = "tt_react_auth";

export function getStoredAuth(): AuthPayload | null {
  const raw = localStorage.getItem(AUTH_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthPayload;
  } catch {
    return null;
  }
}

export function setStoredAuth(payload: AuthPayload): void {
  localStorage.setItem(AUTH_KEY, JSON.stringify(payload));
}

export function clearStoredAuth(): void {
  localStorage.removeItem(AUTH_KEY);
}
