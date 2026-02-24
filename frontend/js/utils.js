const UI_KEY = "tt_altyn_ui";

export function escapeHtml(text = "") {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function formatDateDari(isoDate) {
  if (!isoDate) return "-";
  const d = new Date(isoDate);
  if (Number.isNaN(d.getTime())) return isoDate;
  return new Intl.DateTimeFormat("fa-AF-u-ca-gregory-nu-latn", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

export function debounce(fn, delay = 300) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), delay);
  };
}

export function friendlyNowRangeLabel() {
  const now = new Date();
  const hour = now.getHours();
  if (hour < 12) return "صبح بخیر";
  if (hour < 18) return "روز بخیر";
  return "شب بخیر";
}

export function loadUiState() {
  try {
    return JSON.parse(localStorage.getItem(UI_KEY) || "{}");
  } catch {
    return {};
  }
}

export function saveUiState(partial) {
  const prev = loadUiState();
  localStorage.setItem(UI_KEY, JSON.stringify({ ...prev, ...partial }));
}

export function toCsv(items) {
  return items.map((x) => x.replaceAll(",", " ")).join(",");
}
