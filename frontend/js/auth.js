const KEY = "tt_altyn_auth";

export function saveAuth(payload) {
  localStorage.setItem(KEY, JSON.stringify(payload));
}

export function getAuth() {
  const raw = localStorage.getItem(KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function clearAuth() {
  localStorage.removeItem(KEY);
}
