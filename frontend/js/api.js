import { clearAuth, getAuth, saveAuth } from "./auth.js";

const BASE = "";
const REQUEST_TIMEOUT_MS = 12000;

async function request(path, opts = {}, retry = true) {
  const auth = getAuth();
  const headers = { "Content-Type": "application/json", ...(opts.headers || {}) };
  if (auth?.access_token) headers.Authorization = `Bearer ${auth.access_token}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let res;
  try {
    res = await fetch(`${BASE}${path}`, { ...opts, headers, signal: controller.signal });
  } catch (err) {
    if (err?.name === "AbortError") {
      throw new Error("درخواست زمان‌بر شد. لطفا دوباره تلاش کنید.");
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
  const parsed = await res.json().catch(() => ({}));
  const data = parsed && typeof parsed === "object" ? parsed : {};
  if (res.status === 401 && retry && auth?.refresh_token) {
    const refreshed = await refresh(auth.refresh_token);
    if (refreshed) return request(path, opts, false);
    clearAuth();
  }
  if (!res.ok || data.success === false) {
    const message = data?.error?.message || "خطا در درخواست";
    throw new Error(message);
  }
  return data.data;
}

export async function refresh(refreshToken) {
  try {
    const res = await fetch("/api/auth/refresh", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) return false;
    const auth = getAuth();
    saveAuth({ ...auth, access_token: data.data.access_token });
    return true;
  } catch {
    return false;
  }
}

export const api = {
  get: (path) => request(path),
  post: (path, body) => request(path, { method: "POST", body: JSON.stringify(body) }),
  put: (path, body) => request(path, { method: "PUT", body: JSON.stringify(body) }),
  del: (path) => request(path, { method: "DELETE" }),
};
