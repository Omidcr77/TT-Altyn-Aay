
import { api } from "./api.js";
import { clearAuth, getAuth, saveAuth } from "./auth.js";
import { debounce, formatDateDari, friendlyNowRangeLabel } from "./utils.js";
import { closeDrawer, confirmDialog, emptyStateSvg, escapeHtml, icon, initThemeToggle, openDrawer, openModal, renderTable, renderTabs, skeletonCards, skeletonLines, statusPill, toast } from "../assets/ui.js";

const DRAFT_KEY = "tt_activity_draft";
const state = {
  user: null, role: null, ws: null, page: "dashboard",
  wsPollTimer: null,
  notifications: [], unread: 0, staff: [], activityTypes: [],
  presets: [],
  filters: { tab: "pending", search: "", dateFrom: "", dateTo: "", status: "pending", staffId: "", activityType: "", location: "" },
  sort: { key: "date", dir: "desc" }, pageNo: 1, pageSize: 10, total: 0, activities: []
};
const $ = (id) => document.getElementById(id);
const canManage = () => ["admin", "manager"].includes(state.role);

function setIcons() {
  $("menu-toggle").innerHTML = icon("menu");
  $("notif-toggle").innerHTML = `${icon("bell")}<span class="notif-count" id="notif-badge">0</span>`;
  $("user-menu-btn").innerHTML = `${icon("user")} پروفایل`;
}
function setView(loggedIn) { $("login-view").classList.toggle("hidden", loggedIn); $("app-view").classList.toggle("hidden", !loggedIn); }
function toggleSidebar(open) {
  const next = typeof open === "boolean" ? open : !$("sidebar").classList.contains("open");
  $("sidebar").classList.toggle("open", next); $("mobile-backdrop").classList.toggle("open", next); $("menu-toggle").setAttribute("aria-expanded", String(next));
}
function closePopovers() {
  $("notification-panel").classList.remove("open"); $("notif-toggle").setAttribute("aria-expanded", "false");
  $("user-menu").classList.remove("open"); $("user-menu-btn").setAttribute("aria-expanded", "false");
}
function setPage(page) {
  state.page = page;
  document.querySelectorAll(".page").forEach((p) => p.classList.remove("active"));
  document.querySelectorAll(".nav-item").forEach((n) => n.classList.toggle("active", n.dataset.page === page));
  $(`page-${page}`).classList.add("active");
  if (window.innerWidth < 980) toggleSidebar(false);
  closePopovers();
  renderPage();
}

async function loadMe() { const me = await api.get("/api/auth/me"); state.user = me; state.role = me.role; }
function applyRoleUi() {
  document.querySelectorAll(".admin-only").forEach((x) => (x.style.display = state.role === "admin" ? "" : "none"));
  $("current-user").textContent = `${state.user.username} (${state.role})`;
  $("user-menu-name").textContent = state.user.username;
  $("sidebar-greeting").textContent = friendlyNowRangeLabel();
}
async function loadMeta() {
  const [staff, master] = await Promise.all([api.get("/api/staff"), api.get("/api/master-data")]);
  state.staff = staff; state.activityTypes = master.filter((x) => x.category === "activity_type" && x.active).map((x) => x.value);
  try { state.presets = await api.get("/api/dashboard/presets"); } catch { state.presets = []; }
}
async function loadNotifications() {
  const data = await api.get("/api/notifications"); state.notifications = data.items || []; state.unread = data.unread_count || 0; $("notif-badge").textContent = String(state.unread);
}
function renderNotifPanel() {
  const panel = $("notification-panel");
  if (!state.notifications.length) { panel.innerHTML = `<div class="card">${emptyStateSvg("اعلانی موجود نیست")}</div>`; return; }
  panel.innerHTML = state.notifications.map((n) => `<article class="notification-item"><p>${escapeHtml(n.text)}</p><p class="muted">${formatDateDari(n.created_at)}</p><div class="tabs">${!n.read_at ? `<button class="btn btn-ghost" data-read="${n.id}">علامت خوانده شد</button>` : ""}${n.activity_id ? `<button class="btn btn-secondary" data-open="${n.activity_id}">مشاهده فعالیت</button>` : ""}</div></article>`).join("");
  panel.querySelectorAll("[data-read]").forEach((b) => b.addEventListener("click", async () => { await api.post(`/api/notifications/${b.dataset.read}/read`, {}); await loadNotifications(); renderNotifPanel(); }));
  panel.querySelectorAll("[data-open]").forEach((b) => b.addEventListener("click", async () => { setPage("activities"); await openDetail(Number(b.dataset.open)); }));
}
function connectWs() {
  if (state.ws) state.ws.close();
  if (state.wsPollTimer) { clearInterval(state.wsPollTimer); state.wsPollTimer = null; }
  const auth = getAuth(); if (!auth?.access_token) return;
  const proto = location.protocol === "https:" ? "wss" : "ws";
  state.ws = new WebSocket(`${proto}://${location.host}/api/notifications/ws?token=${encodeURIComponent(auth.access_token)}`);
  state.ws.onopen = () => {
    if (state.wsPollTimer) { clearInterval(state.wsPollTimer); state.wsPollTimer = null; }
  };
  state.ws.onmessage = async (ev) => { const p = JSON.parse(ev.data); toast(p.text, "info"); await loadNotifications(); renderNotifPanel(); };
  const startPollFallback = () => {
    if (state.wsPollTimer) return;
    state.wsPollTimer = setInterval(async () => {
      try { await loadNotifications(); renderNotifPanel(); } catch {}
    }, 20000);
  };
  state.ws.onerror = () => { startPollFallback(); };
  state.ws.onclose = () => { state.ws = null; startPollFallback(); };
}

function card(title, value, hint) { return `<article class="card"><p class="muted">${title}</p><p class="kpi-value">${value}</p><p class="muted">${hint}</p></article>`; }
function bars(title, rows) {
  const max = Math.max(1, ...rows.map((x) => x.count || 0));
  return `<section class="card"><h3>${title}</h3><div class="simple-bars">${rows.slice(0, 6).map((r) => `<div class="bar-row"><span>${escapeHtml(r.name)}</span><div class="bar-track"><div class="bar-fill" style="width:${Math.max(8, Math.round((r.count / max) * 100))}%"></div></div><strong>${r.count}</strong></div>`).join("")}</div></section>`;
}
function trendChart(title, items) {
  if (!items?.length) return `<section class="card"><h3>${title}</h3>${emptyStateSvg("داده روند موجود نیست")}</section>`;
  const max = Math.max(1, ...items.map((x) => Math.max(x.created || 0, x.done || 0)));
  return `<section class="card"><h3>${title}</h3><div class="simple-bars">${items.slice(-14).map((x) => `<div class="bar-row"><span>${escapeHtml(x.date.slice(5))}</span><div class="bar-track"><div class="bar-fill" style="width:${Math.max(6, Math.round(((x.created || 0) / max) * 100))}%"></div></div><strong>${x.created || 0}/${x.done || 0}</strong></div>`).join("")}</div><p class="muted">فرمت: ایجاد/انجام</p></section>`;
}
async function renderDashboard() {
  const root = $("page-dashboard"); root.innerHTML = `${skeletonCards(4)}${skeletonLines(8)}`;
  const [stats, trends] = await Promise.all([api.get("/api/dashboard/stats"), api.get("/api/dashboard/trends?days=30")]);
  root.innerHTML = `<header class="grid"><h2 id="page-title-dashboard" class="page-title">داشبورد</h2><p class="muted">نمای کلی فعالیت ها</p></header><section class="kpi-grid">${card("در انتظار", stats.pending, "نیازمند اقدام")}${card("انجام شد", stats.done, "تکمیل شده")}${card("امروز", stats.total_today, "ثبت روز")}${card("این هفته", stats.total_week, "از شروع هفته")}</section><section class="chart-grid">${bars("بر اساس نوع", stats.by_type || [])}${bars("بر اساس کارمند", stats.by_staff || [])}</section>${trendChart("روند 30 روز اخیر", trends.items || [])}<section class="card"><h3>فعالیت های اخیر</h3><div id="recent-table"></div></section>`;
  const rows = (stats.recent || []).map((r) => ({ ...r, status_html: statusPill(r.status, r.date) }));
  renderTable({ container: $("recent-table"), columns: [{ key: "date", label: "تاریخ", render: (r) => formatDateDari(r.date) }, { key: "customer_name", label: "مشتری" }, { key: "activity_type", label: "نوع" }, { key: "status_html", label: "وضعیت", render: (r) => r.status_html }], rows, sort: { key: "date", dir: "desc" }, pagination: { page: 1, pageSize: rows.length || 1, total: rows.length || 1 } });
}

function buildQuery() {
  const p = new URLSearchParams();
  p.set("page", String(state.pageNo)); p.set("page_size", String(state.pageSize)); p.set("status", state.filters.tab);
  if (state.filters.search) p.set("search", state.filters.search);
  if (state.filters.dateFrom) p.set("date_from", state.filters.dateFrom);
  if (state.filters.dateTo) p.set("date_to", state.filters.dateTo);
  if (state.filters.staffId) p.set("staff_id", state.filters.staffId);
  if (state.filters.location) p.set("location", state.filters.location);
  return p.toString();
}
function sortRows(rows) {
  const dir = state.sort.dir === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    let av = a[state.sort.key], bv = b[state.sort.key];
    if (state.sort.key === "date") { av = new Date(a.date).getTime(); bv = new Date(b.date).getTime(); }
    if (state.sort.key === "status") { av = a.status === "done" ? 1 : 0; bv = b.status === "done" ? 1 : 0; }
    if (typeof av === "string") av = av.toLowerCase(); if (typeof bv === "string") bv = bv.toLowerCase();
    if (av > bv) return dir; if (av < bv) return -dir; return 0;
  });
}
function rowMenu(row) {
  return `<div class="action-menu"><button class="btn btn-icon btn-ghost" data-actions="${row.id}" aria-label="اقدام ها">${icon("more")}</button><div class="action-list" id="actions-${row.id}"><button data-act="view" data-id="${row.id}">مشاهده</button><button data-act="edit" data-id="${row.id}">ویرایش</button>${state.role === "admin" ? `<button data-act="assign" data-id="${row.id}">تعیین کارمند</button>` : ""}${state.role === "admin" && row.status === "pending" ? `<button data-act="done" data-id="${row.id}">علامه انجام شد</button>` : ""}${state.role === "admin" ? `<button data-act="delete" data-id="${row.id}">حذف</button>` : ""}</div></div>`;
}
async function openDetail(id) {
  const a = await api.get(`/api/activities/${id}`);
  openDrawer({ title: `فعالیت #${a.id}`, content: `<div class="grid"><article class="card"><strong>تاریخ:</strong> ${formatDateDari(a.date)}</article><article class="card"><strong>مشتری:</strong> ${escapeHtml(a.customer_name)}</article><article class="card"><strong>نوع:</strong> ${escapeHtml(a.activity_type)}</article><article class="card"><strong>آدرس:</strong> ${escapeHtml(a.location || "-")}</article><article class="card"><strong>آدرس:</strong> ${escapeHtml(a.address || "-")}</article><article class="card"><strong>کارمند:</strong> ${escapeHtml(a.assigned_staff.map((s) => s.name).join("، ") || "-")}</article><article class="card"><strong>وضعیت:</strong> ${statusPill(a.status, a.date)}</article><article class="card"><strong>گزارش:</strong> ${escapeHtml(a.report_text || "-")}</article></div>` });
}
async function quickEdit(row) {
  const checked = new Set(row.assigned_staff.map((s) => s.id));
  const id = `quick-${row.id}`;
  await openModal({ title: "ویرایش سریع / تعیین کارمند", content: `<form id="${id}" class="form-card"><div class="form-section"><h4 class="section-title">جزئیات فعالیت</h4><div class="form-grid"><div class="form-field"><label>تاریخ</label><input name="date" type="date" value="${row.date}" required /></div><div class="form-field"><label>وضعیت</label><select name="status" ${state.role !== "admin" ? "disabled" : ""}><option value="pending" ${row.status === "pending" ? "selected" : ""}>در انتظار</option><option value="done" ${row.status === "done" ? "selected" : ""}>انجام شد</option></select></div><div class="form-field"><label>اولویت</label><input name="priority" type="number" min="0" max="1000" value="${row.priority}" /></div></div></div><div class="form-section"><h4 class="section-title">تعیین کارمند</h4><div class="form-field"><label>جستجوی کارمند</label><input id="q-staff" type="text" placeholder="نام کارمند" /></div><div id="q-list" class="grid"></div></div></form>`, actions: [{ label: "انصراف", variant: "btn-secondary", value: false }, { label: "ذخیره", variant: "btn-primary", onClick: async () => { const f = document.getElementById(id); const fd = new FormData(f); const payload = { date: fd.get("date"), status: state.role === "admin" ? fd.get("status") : row.status, priority: Number(fd.get("priority") || 0), assigned_staff_ids: [...f.querySelectorAll("input[name='staff_ids']:checked")].map((x) => Number(x.value)) }; await api.put(`/api/activities/${row.id}`, payload); toast("ویرایش ذخیره شد", "success"); await renderActivities(); } }] });
  const list = document.getElementById("q-list");
  const render = (q = "") => { const s = q.toLowerCase().trim(); list.innerHTML = state.staff.filter((x) => x.active && (!s || x.name.toLowerCase().includes(s))).map((x) => `<label><input type="checkbox" name="staff_ids" value="${x.id}" ${checked.has(x.id) ? "checked" : ""} /> ${escapeHtml(x.name)}</label>`).join(""); };
  render(); document.getElementById("q-staff").addEventListener("input", (e) => render(e.target.value));
}
function bindRowActions() {
  document.querySelectorAll("[data-actions]").forEach((b) => b.addEventListener("click", (e) => { e.stopPropagation(); document.querySelectorAll(".action-list.open").forEach((x) => x.classList.remove("open")); document.getElementById(`actions-${b.dataset.actions}`)?.classList.toggle("open"); }));
  document.querySelectorAll("[data-act]").forEach((b) => b.addEventListener("click", async () => {
    const id = Number(b.dataset.id); const act = b.dataset.act; const row = state.activities.find((x) => x.id === id); if (!row) return;
    if (act === "view") return openDetail(id);
    if (act === "edit" || act === "assign") return quickEdit(row);
    if (act === "done") { const ok = await confirmDialog({ title: "تایید", message: "این فعالیت انجام شده علامت شود؟", confirmText: "بله" }); if (!ok) return; await api.post(`/api/activities/${id}/mark-done`, {}); toast("انجام شد", "success"); return renderActivities(); }
    if (act === "delete") { const ok = await confirmDialog({ title: "حذف", message: "این فعالیت حذف شود؟", confirmText: "حذف", danger: true }); if (!ok) return; await api.del(`/api/activities/${id}`); toast("حذف شد", "success"); return renderActivities(); }
  }));
}
async function renderActivitiesTable() {
  try {
    const data = await api.get(`/api/activities?${buildQuery()}`);
    state.total = data.total || 0;
    let rows = data.items || [];
    if (state.filters.activityType) rows = rows.filter((x) => x.activity_type === state.filters.activityType);
    state.activities = sortRows(rows);
    const columns = [{ key: "date", label: "تاریخ", sortable: true, render: (r) => formatDateDari(r.date) }, { key: "customer_name", label: "مشتری", sortable: true, render: (r) => escapeHtml(r.customer_name) }, { key: "location", label: "آدرس", render: (r) => escapeHtml(r.location || "-") }, { key: "activity_type", label: "نوع", render: (r) => escapeHtml(r.activity_type) }, { key: "assigned", label: "کارمند", render: (r) => escapeHtml(r.assigned_staff.map((s) => s.name).join("، ") || "-") }, { key: "status", label: "وضعیت", sortable: true, render: (r) => statusPill(r.status, r.date) }];
    if (canManage()) columns.unshift({ key: "bulk", label: "انتخاب", render: (r) => `<input type="checkbox" data-bulk-id="${r.id}" />` });
    renderTable({ container: $("activities-table"), columns, rows: state.activities, rowActions: rowMenu, sort: state.sort, pagination: { page: state.pageNo, pageSize: state.pageSize, total: state.total }, onSort: async (k, d) => { state.sort = { key: k, dir: d }; await renderActivitiesTable(); }, onPage: async (dir) => { state.pageNo += dir === "next" ? 1 : -1; state.pageNo = Math.max(1, state.pageNo); await renderActivitiesTable(); }, emptyMessage: "هیچ فعالیتی با این فیلتر پیدا نشد" });
    bindRowActions();
  } catch (err) {
    $("activities-table").innerHTML = `<section class="card grid"><p>${escapeHtml(err.message || "خطا")}</p><button id="retry-activities" class="btn btn-secondary">تلاش دوباره</button></section>`;
    $("retry-activities").addEventListener("click", renderActivitiesTable);
  }
}
async function renderActivities() {
  const root = $("page-activities");
  root.innerHTML = `<header class="grid"><h2 id="page-title-activities" class="page-title">فعالیت ها</h2><p class="muted">پیگیری، فیلتر و مدیریت وضعیت</p><div id="activity-tabs"></div></header><section class="card"><h3>Preset ها</h3><div class="tabs"><select id="preset-select"><option value="">انتخاب preset</option>${state.presets.map((p) => `<option value="${p.id}">${escapeHtml(p.name)}${p.is_shared ? " (مشترک)" : ""}</option>`).join("")}</select><button id="apply-preset" class="btn btn-secondary">اعمال</button><button id="save-preset" class="btn btn-primary">ذخیره</button><button id="delete-preset" class="btn btn-danger">حذف</button></div></section>${canManage() ? `<section class="card"><h3>Bulk عملیات</h3><div class="tabs"><select id="bulk-action"><option value=\"set_status\">تغییر وضعیت</option><option value=\"assign_staff\">تعیین کارمند</option><option value=\"set_priority\">تغییر اولویت</option><option value=\"delete\">حذف</option></select><input id="bulk-value" placeholder="مقدار (مثلا done یا 5 یا 1,2)" /><button id="run-bulk" class="btn btn-primary">اجرا روی انتخاب شده</button></div></section>` : ""}<section class="card"><div class="filter-head"><h3>فیلترها</h3><button id="toggle-filters" class="btn btn-ghost" aria-expanded="true">نمایش/پنهان</button></div><div id="filters-panel" class="filters-panel"><div class="filter-grid" style="margin-top:12px;"><div class="form-field"><label>از تاریخ</label><input id="flt-date-from" type="date" value="${state.filters.dateFrom}" /></div><div class="form-field"><label>تا تاریخ</label><input id="flt-date-to" type="date" value="${state.filters.dateTo}" /></div><div class="form-field"><label>وضعیت</label><select id="flt-status"><option value="">همه</option><option value="pending" ${state.filters.status === "pending" ? "selected" : ""}>در انتظار</option><option value="done" ${state.filters.status === "done" ? "selected" : ""}>انجام شد</option></select></div><div class="form-field"><label>کارمند</label><select id="flt-staff"><option value="">همه</option>${state.staff.filter((s) => s.active).map((s) => `<option value="${s.id}" ${String(s.id) === String(state.filters.staffId) ? "selected" : ""}>${escapeHtml(s.name)}</option>`).join("")}</select></div><div class="form-field"><label>نوع</label><select id="flt-type"><option value="">همه</option>${state.activityTypes.map((x) => `<option value="${escapeHtml(x)}" ${x === state.filters.activityType ? "selected" : ""}>${escapeHtml(x)}</option>`).join("")}</select></div><div class="form-field"><label>آدرس</label><input id="flt-location" value="${escapeHtml(state.filters.location)}" /></div><div class="form-field"><label>جستجو</label><input id="flt-search" value="${escapeHtml(state.filters.search)}" /></div><div class="form-field" style="align-self:end;"><button id="apply-filters" class="btn btn-primary">اعمال فیلتر</button></div></div></div></section><section id="activities-table" class="grid">${skeletonLines(10)}</section>`;
  const stats = await api.get("/api/dashboard/stats");
  renderTabs($("activity-tabs"), [{ value: "pending", label: `در انتظار (${stats.pending || 0})` }, { value: "done", label: `انجام شد (${stats.done || 0})` }], state.filters.tab, async (v) => { state.filters.tab = v; state.filters.status = v; state.pageNo = 1; await renderActivities(); });
  $("toggle-filters").addEventListener("click", () => { $("filters-panel").classList.toggle("collapsed"); $("toggle-filters").setAttribute("aria-expanded", String(!$("filters-panel").classList.contains("collapsed"))); });
  $("apply-filters").addEventListener("click", async () => { state.filters.dateFrom = $("flt-date-from").value; state.filters.dateTo = $("flt-date-to").value; state.filters.status = $("flt-status").value || state.filters.tab; state.filters.staffId = $("flt-staff").value; state.filters.activityType = $("flt-type").value; state.filters.location = $("flt-location").value.trim(); state.filters.search = $("flt-search").value.trim(); state.pageNo = 1; await renderActivitiesTable(); });
  $("apply-preset").addEventListener("click", async () => {
    const selectedId = Number($("preset-select").value || 0);
    const preset = state.presets.find((x) => x.id === selectedId);
    if (!preset) return;
    state.filters = { ...state.filters, ...(preset.filters || {}) };
    state.pageNo = 1;
    await renderActivities();
  });
  $("save-preset").addEventListener("click", async () => {
    const id = `preset-create`;
    const shared = canManage() ? `<label><input id="preset-shared" type="checkbox" /> مشترک</label>` : "";
    await openModal({
      title: "ذخیره preset",
      content: `<form id="${id}" class="form-grid"><div class="form-field"><label>نام</label><input id="preset-name" required /></div><div class="form-field">${shared}</div></form>`,
      actions: [{ label: "انصراف", variant: "btn-secondary", value: false }, {
        label: "ذخیره", variant: "btn-primary", onClick: async () => {
          const name = document.getElementById("preset-name")?.value?.trim();
          if (!name) return false;
          const is_shared = !!document.getElementById("preset-shared")?.checked;
          await api.post("/api/dashboard/presets", { name, filters: state.filters, is_shared });
          state.presets = await api.get("/api/dashboard/presets");
          toast("preset ذخیره شد", "success");
          await renderActivities();
        }
      }]
    });
  });
  $("delete-preset").addEventListener("click", async () => {
    const selectedId = Number($("preset-select").value || 0);
    if (!selectedId) return;
    const ok = await confirmDialog({ title: "حذف preset", message: "این preset حذف شود؟", confirmText: "حذف", danger: true });
    if (!ok) return;
    await api.del(`/api/dashboard/presets/${selectedId}`);
    state.presets = await api.get("/api/dashboard/presets");
    toast("preset حذف شد", "success");
    await renderActivities();
  });
  if (canManage()) {
    $("run-bulk").addEventListener("click", async () => {
      const ids = [...document.querySelectorAll("[data-bulk-id]:checked")].map((x) => Number(x.dataset.bulkId));
      if (!ids.length) return toast("هیچ ردیفی انتخاب نشده", "error");
      const action = $("bulk-action").value;
      const raw = $("bulk-value").value.trim();
      const payload = { action, ids };
      if (action === "set_status") payload.status = raw || "pending";
      if (action === "assign_staff") payload.staff_ids = raw ? raw.split(",").map((x) => Number(x.trim())).filter((x) => !Number.isNaN(x)) : [];
      if (action === "set_priority") payload.priority = Number(raw || 0);
      const ok = await confirmDialog({ title: "Bulk Action", message: `اکشن ${action} روی ${ids.length} مورد اجرا شود؟`, confirmText: "اجرا", danger: action === "delete" });
      if (!ok) return;
      await api.post("/api/activities/bulk", payload);
      toast("عملیات دسته ای انجام شد", "success");
      await renderActivitiesTable();
    });
  }
  await renderActivitiesTable();
}
function getDraft() { try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || "{}"); } catch { return {}; } }
function saveDraft(form) { const fd = new FormData(form); localStorage.setItem(DRAFT_KEY, JSON.stringify({ date: fd.get("date") || "", activity_type: fd.get("activity_type") || "", customer_name: fd.get("customer_name") || "", address: fd.get("address") || "", location: fd.get("location") || "", report_text: fd.get("report_text") || "", priority: fd.get("priority") || "0", assigned: [...form.querySelectorAll("input[name='staff']:checked")].map((x) => Number(x.value)) })); }
async function renderNewActivity() {
  const root = $("page-new-activity"); root.innerHTML = skeletonLines(10); const d = getDraft();
  root.innerHTML = `<header class="grid"><h2 id="page-title-new-activity" class="page-title">افزودن فعالیت</h2><p class="muted">ثبت فعالیت جدید</p></header><form id="new-activity-form" class="card form-card" novalidate><section class="form-section"><h3 class="section-title">معلومات مشتری</h3><div class="form-grid"><div class="form-field"><label>نام مشتری <span class="required">*</span></label><input id="na-customer" name="customer_name" value="${escapeHtml(d.customer_name || "")}" list="customer-list" required /><small data-error="customer_name" class="field-error"></small></div><div class="form-field"><label>آدرس</label><input id="na-address" name="address" value="${escapeHtml(d.address || "")}" list="address-list" /></div><div class="form-field"><label>آدرس</label><input name="location" value="${escapeHtml(d.location || "")}" /></div></div></section><section class="form-section"><h3 class="section-title">جزئیات فعالیت</h3><div class="form-grid"><div class="form-field"><label>تاریخ <span class="required">*</span></label><input name="date" type="date" value="${escapeHtml(d.date || "")}" required /><small data-error="date" class="field-error"></small></div><div class="form-field"><label>نوع فعالیت <span class="required">*</span></label><input name="activity_type" value="${escapeHtml(d.activity_type || "")}" list="type-list" required /><small data-error="activity_type" class="field-error"></small></div><div class="form-field"><label>اولویت</label><input name="priority" type="number" min="0" max="1000" value="${escapeHtml(d.priority || "0")}" /></div><div class="form-field" style="grid-column:1 / -1;"><label>گزارش</label><textarea name="report_text" rows="4">${escapeHtml(d.report_text || "")}</textarea></div></div></section><section class="form-section"><h3 class="section-title">تعیین کارمند</h3><div class="form-field"><label>جستجوی کارمند</label><input id="na-staff-search" type="text" placeholder="نام کارمند" /></div><div id="na-staff-list" class="grid"></div></section><div class="tabs"><button class="btn btn-primary" type="submit">${icon("plus")} ذخیره فعالیت</button><button class="btn btn-secondary" type="reset">پاکسازی</button></div><datalist id="customer-list"></datalist><datalist id="address-list"></datalist><datalist id="type-list">${state.activityTypes.map((t) => `<option value="${escapeHtml(t)}"></option>`).join("")}</datalist></form>`;
  const form = $("new-activity-form"); const box = $("na-staff-list"); const selected = new Set(d.assigned || []);
  const staffRender = (q = "") => { const s = q.toLowerCase().trim(); box.innerHTML = state.staff.filter((x) => x.active && (!s || x.name.toLowerCase().includes(s))).map((x) => `<label><input type="checkbox" name="staff" value="${x.id}" ${selected.has(x.id) ? "checked" : ""} /> ${escapeHtml(x.name)}</label>`).join(""); };
  staffRender(); $("na-staff-search").addEventListener("input", (e) => staffRender(e.target.value));
  const suggest = async (field, val, target) => { if (!val.trim()) return; const items = await api.get(`/api/suggestions?field=${field}&q=${encodeURIComponent(val)}`); $(target).innerHTML = items.map((v) => `<option value="${escapeHtml(v)}"></option>`).join(""); };
  $("na-customer").addEventListener("input", debounce((e) => suggest("customer_name", e.target.value, "customer-list"), 250));
  $("na-address").addEventListener("input", debounce((e) => suggest("address", e.target.value, "address-list"), 250));
  form.addEventListener("input", () => saveDraft(form));
  form.addEventListener("reset", () => { localStorage.removeItem(DRAFT_KEY); setTimeout(() => { staffRender(); form.querySelectorAll(".field-error").forEach((x) => (x.textContent = "")); }, 0); });
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const req = ["date", "activity_type", "customer_name"]; let ok = true;
    req.forEach((n) => { const i = form.querySelector(`[name='${n}']`); const er = form.querySelector(`[data-error='${n}']`); if (!String(i.value || "").trim()) { ok = false; er.textContent = "این فیلد الزامی است."; } else er.textContent = ""; });
    if (!ok) return toast("لطفا فیلدهای ضروری را تکمیل کنید.", "error");
    const fd = new FormData(form);
    const payload = { date: fd.get("date"), activity_type: String(fd.get("activity_type") || "").trim(), customer_name: String(fd.get("customer_name") || "").trim(), address: String(fd.get("address") || "").trim() || null, location: String(fd.get("location") || "").trim() || null, report_text: String(fd.get("report_text") || "").trim() || null, priority: Number(fd.get("priority") || 0), assigned_staff_ids: [...form.querySelectorAll("input[name='staff']:checked")].map((x) => Number(x.value)), extra_fields: {}, device_info: null };
    try { const created = await api.post("/api/activities", payload); localStorage.removeItem(DRAFT_KEY); toast("فعالیت با موفقیت ثبت شد.", "success"); setPage("activities"); await renderActivities(); await openDetail(created.id); } catch (err) { toast(err.message || "ثبت فعالیت ناموفق بود.", "error"); }
  });
}
async function renderNotificationsPage() {
  const r = $("page-notifications"); r.innerHTML = `<header class="grid"><h2 id="page-title-notifications" class="page-title">اعلان ها</h2><p class="muted">مرکز اعلان ها</p></header>${canManage() ? `<section class="card"><h3>قوانین اعلان</h3><form id="rule-form" class="form-grid"><div class="form-field"><label><input id="rule-overdue" type="checkbox" /> معطل</label></div><div class="form-field"><label><input id="rule-unassigned" type="checkbox" /> بدون کارمند</label></div><div class="form-field"><label><input id="rule-priority" type="checkbox" /> اولویت بالا</label></div><div class="form-field"><label>حد اولویت</label><input id="rule-threshold" type="number" min="0" max="1000" /></div><div class="form-field"><label>روزهای معطل</label><input id="rule-overdue-days" type="number" min="0" max="365" /></div><div class="form-field" style="align-self:end;"><button class="btn btn-primary" type="submit">ذخیره قوانین</button></div><div class="form-field" style="align-self:end;"><button id="run-rules" class="btn btn-secondary" type="button">اجرای فوری</button></div></form></section>` : ""}<section class="card" id="notif-page-list"></section>`;
  if (canManage()) {
    try {
      const rules = await api.get("/api/notifications/rules");
      $("rule-overdue").checked = !!rules.overdue_enabled;
      $("rule-unassigned").checked = !!rules.unassigned_enabled;
      $("rule-priority").checked = !!rules.high_priority_enabled;
      $("rule-threshold").value = String(rules.high_priority_threshold ?? 5);
      $("rule-overdue-days").value = String(rules.overdue_days ?? 0);
      $("rule-form").addEventListener("submit", async (e) => {
        e.preventDefault();
        await api.post("/api/notifications/rules", {
          overdue_enabled: $("rule-overdue").checked,
          unassigned_enabled: $("rule-unassigned").checked,
          high_priority_enabled: $("rule-priority").checked,
          high_priority_threshold: Number($("rule-threshold").value || 5),
          overdue_days: Number($("rule-overdue-days").value || 0),
        });
        toast("قوانین اعلان ذخیره شد", "success");
      });
      $("run-rules").addEventListener("click", async () => {
        const data = await api.post("/api/notifications/rules/run", {});
        toast(`قوانین اجرا شد (${data.created || 0})`, "success");
        await loadNotifications();
        renderNotifPanel();
        await renderNotificationsPage();
      });
    } catch {
      toast("بارگذاری قوانین اعلان ناموفق بود", "error");
    }
  }
  const box = $("notif-page-list"); if (!state.notifications.length) { box.innerHTML = emptyStateSvg("اعلان جدیدی وجود ندارد"); return; }
  box.innerHTML = state.notifications.map((n) => `<article class="notification-item"><p>${escapeHtml(n.text)}</p><p class="muted">${formatDateDari(n.created_at)}</p><div class="tabs">${!n.read_at ? `<button class="btn btn-ghost" data-mark-page="${n.id}">علامت خوانده شد</button>` : ""}${n.activity_id ? `<button class="btn btn-secondary" data-view-page="${n.activity_id}">مشاهده فعالیت</button>` : ""}</div></article>`).join("");
  box.querySelectorAll("[data-mark-page]").forEach((b) => b.addEventListener("click", async () => { await api.post(`/api/notifications/${b.dataset.markPage}/read`, {}); await loadNotifications(); renderNotifPanel(); await renderNotificationsPage(); }));
  box.querySelectorAll("[data-view-page]").forEach((b) => b.addEventListener("click", async () => { setPage("activities"); await openDetail(Number(b.dataset.viewPage)); }));
}
function renderAuditFields(detailJson) {
  if (!detailJson) return "<p class='muted'>جزئیات ندارد</p>";
  let parsed = null;
  try { parsed = JSON.parse(detailJson); } catch { return "<p class='muted'>جزئیات قابل خواندن نیست</p>"; }
  const changed = Array.isArray(parsed.changed_fields) ? parsed.changed_fields : [];
  if (!changed.length) return "<p class='muted'>تغییر مشخصی ثبت نشده</p>";
  return `<div class="tabs">${changed.map((x) => `<span class="status-pill pending">${escapeHtml(String(x))}</span>`).join("")}</div>`;
}
async function renderAuditPage() {
  const r = $("page-audit");
  if (state.role !== "admin") { r.innerHTML = `<section class="card">${emptyStateSvg("این بخش فقط برای ادمین است")}</section>`; return; }
  r.innerHTML = `<header class="grid"><h2 id="page-title-audit" class="page-title">ممیزی</h2><p class="muted">timeline تغییرات و بازگردانی</p></header><section id="audit-list" class="grid">${skeletonLines(6)}</section>`;
  const data = await api.get("/api/audit?page=1&page_size=50");
  const items = data.items || [];
  const list = $("audit-list");
  if (!items.length) { list.innerHTML = emptyStateSvg("لاگ ممیزی موجود نیست"); return; }
  list.innerHTML = items.map((x) => `<article class="card"><div class="tabs"><strong>${escapeHtml(x.action)}</strong><span class="muted">${escapeHtml(x.entity)} #${escapeHtml(x.entity_id)}</span><span class="muted">${formatDateDari(x.created_at)}</span><span class="muted">${escapeHtml(x.username || "-")}</span></div>${renderAuditFields(x.detail_json)}${x.undoable ? `<div class="tabs"><button class="btn btn-secondary" data-undo-audit="${x.id}">بازگردانی</button></div>` : ""}</article>`).join("");
  list.querySelectorAll("[data-undo-audit]").forEach((b) => b.addEventListener("click", async () => {
    const ok = await confirmDialog({ title: "بازگردانی", message: "این عمل بازگردانی شود؟", confirmText: "بازگردانی" });
    if (!ok) return;
    await api.post(`/api/audit/${b.dataset.undoAudit}/undo`, {});
    toast("بازگردانی انجام شد", "success");
    await loadNotifications();
    renderNotifPanel();
    await renderAuditPage();
  }));
}
async function renderStaffPage() {
  const r = $("page-staff");
  if (state.role !== "admin") { r.innerHTML = `<section class="card">${emptyStateSvg("این بخش فقط برای ادمین است")}</section>`; return; }
  r.innerHTML = `<header class="grid"><h2 id="page-title-staff" class="page-title">کارمندان</h2><p class="muted">مدیریت تیم</p></header><section class="card"><form id="staff-form" class="form-grid"><div class="form-field"><label>نام *</label><input name="name" required /></div><div class="form-field"><label>شماره</label><input name="phone" /></div><div class="form-field" style="align-self:end;"><button class="btn btn-primary" type="submit">افزودن</button></div></form></section><section id="staff-table"></section>`;
  renderTable({ container: $("staff-table"), columns: [{ key: "name", label: "نام" }, { key: "phone", label: "شماره", render: (x) => escapeHtml(x.phone || "-") }, { key: "active", label: "وضعیت", render: (x) => (x.active ? "فعال" : "غیرفعال") }], rows: state.staff, sort: { key: "name", dir: "asc" }, pagination: { page: 1, pageSize: state.staff.length || 1, total: state.staff.length || 1 }, rowActions: (x) => `<button class="btn btn-ghost" data-toggle-staff="${x.id}">${x.active ? "غیرفعال" : "فعال"}</button>` });
  $("staff-form").addEventListener("submit", async (e) => { e.preventDefault(); const fd = new FormData(e.target); await api.post("/api/staff", { name: String(fd.get("name") || "").trim(), phone: String(fd.get("phone") || "").trim(), active: true }); toast("کارمند اضافه شد", "success"); await loadMeta(); await renderStaffPage(); });
  r.querySelectorAll("[data-toggle-staff]").forEach((b) => b.addEventListener("click", async () => { const row = state.staff.find((s) => s.id === Number(b.dataset.toggleStaff)); if (!row) return; await api.put(`/api/staff/${row.id}`, { ...row, active: !row.active }); toast("وضعیت کارمند به‌روزرسانی شد", "success"); await loadMeta(); await renderStaffPage(); }));
}
async function renderSettingsPage() {
  const r = $("page-settings"); if (state.role !== "admin") { r.innerHTML = `<section class="card">${emptyStateSvg("این بخش فقط برای ادمین است")}</section>`; return; }
  const [master, settings, backups] = await Promise.all([api.get("/api/master-data"), api.get("/api/master-data/settings/system"), api.get("/api/system/backups").catch(() => [])]);
  const emailEnabled = settings.find((x) => x.key === "email_enabled")?.value === "true";
  const emailRecipients = settings.find((x) => x.key === "email_recipients")?.value || "";
  r.innerHTML = `<header class="grid"><h2 id="page-title-settings" class="page-title">تنظیمات</h2><p class="muted">داده های پایه و اعلان ایمیلی</p></header><section class="card grid"><h3>داده های پایه</h3><form id="master-form" class="form-grid"><div class="form-field"><label>کتگوری</label><select name="category"><option value="activity_type">نوع فعالیت</option><option value="device_type">نوع دستگاه</option><option value="location">آدرس</option></select></div><div class="form-field"><label>مقدار</label><input name="value" required /></div><div class="form-field" style="align-self:end;"><button class="btn btn-primary" type="submit">افزودن</button></div></form><div id="master-table"></div></section><section class="card grid"><h3>اعلان ایمیلی</h3><form id="system-form" class="form-grid"><div class="form-field"><label><input id="email-enabled" type="checkbox" ${emailEnabled ? "checked" : ""} /> فعال</label></div><div class="form-field"><label>گیرنده ها</label><input id="email-recipients" value="${escapeHtml(emailRecipients)}" /></div><div class="form-field" style="align-self:end;"><button class="btn btn-primary" type="submit">ذخیره</button></div></form></section><section class="card grid"><h3>Backup / Restore</h3><div class="tabs"><button id="create-backup" class="btn btn-primary">ایجاد Backup</button></div><div id="backup-table"></div></section>`;
  renderTable({ container: $("master-table"), columns: [{ key: "category", label: "کتگوری" }, { key: "value", label: "مقدار" }, { key: "active", label: "وضعیت", render: (x) => (x.active ? "فعال" : "غیرفعال") }], rows: master, sort: { key: "category", dir: "asc" }, pagination: { page: 1, pageSize: master.length || 1, total: master.length || 1 }, rowActions: (x) => `<button class="btn btn-danger" data-del-master="${x.id}">حذف</button>` });
  $("master-form").addEventListener("submit", async (e) => { e.preventDefault(); const fd = new FormData(e.target); await api.post("/api/master-data", { category: fd.get("category"), value: String(fd.get("value") || "").trim(), active: true }); toast("داده پایه افزوده شد", "success"); await loadMeta(); await renderSettingsPage(); });
  r.querySelectorAll("[data-del-master]").forEach((b) => b.addEventListener("click", async () => { const ok = await confirmDialog({ title: "حذف", message: "این مورد حذف شود؟", confirmText: "حذف", danger: true }); if (!ok) return; await api.del(`/api/master-data/${b.dataset.delMaster}`); toast("حذف انجام شد", "success"); await renderSettingsPage(); }));
  $("system-form").addEventListener("submit", async (e) => { e.preventDefault(); await api.post("/api/master-data/settings/system", { key: "email_enabled", value: String($("email-enabled").checked) }); await api.post("/api/master-data/settings/system", { key: "email_recipients", value: $("email-recipients").value.trim() }); toast("تنظیمات ذخیره شد", "success"); });
  renderTable({
    container: $("backup-table"),
    columns: [{ key: "file", label: "فایل" }, { key: "created_at", label: "تاریخ", render: (x) => formatDateDari(x.created_at) }, { key: "size_bytes", label: "اندازه (بایت)" }],
    rows: backups,
    sort: { key: "created_at", dir: "desc" },
    pagination: { page: 1, pageSize: backups.length || 1, total: backups.length || 1 },
    rowActions: (x) => `<button class="btn btn-danger" data-restore-backup="${escapeHtml(x.file)}">Restore</button>`
  });
  $("create-backup").addEventListener("click", async () => {
    await api.post("/api/system/backups", {});
    toast("Backup ایجاد شد", "success");
    await renderSettingsPage();
  });
  r.querySelectorAll("[data-restore-backup]").forEach((b) => b.addEventListener("click", async () => {
    const file = b.dataset.restoreBackup;
    const ok = await confirmDialog({ title: "Restore Backup", message: `فایل ${file} بازیابی شود؟`, confirmText: "بازیابی", danger: true });
    if (!ok) return;
    await api.post("/api/system/backups/restore", { file });
    toast("Restore انجام شد", "success");
  }));
}
async function renderPage() {
  try { if (state.page === "dashboard") return renderDashboard(); if (state.page === "activities") return renderActivities(); if (state.page === "new-activity") return renderNewActivity(); if (state.page === "notifications") return renderNotificationsPage(); if (state.page === "audit") return renderAuditPage(); if (state.page === "staff") return renderStaffPage(); if (state.page === "settings") return renderSettingsPage(); } catch (err) { const p = $(`page-${state.page}`); p.innerHTML = `<section class="card grid"><h3>خطا در بارگذاری</h3><p>${escapeHtml(err.message || "مشکلی رخ داده است")}</p><button id="retry-page" class="btn btn-secondary">تلاش دوباره</button></section>`; $("retry-page").addEventListener("click", renderPage); }
}
function bindEvents() {
  $("menu-toggle").addEventListener("click", () => toggleSidebar()); $("mobile-backdrop").addEventListener("click", () => toggleSidebar(false));
  document.querySelectorAll(".nav-item").forEach((b) => b.addEventListener("click", () => setPage(b.dataset.page)));
  $("logout-btn").addEventListener("click", async () => { const ok = await confirmDialog({ title: "خروج", message: "از سیستم خارج شوید؟", confirmText: "خروج" }); if (ok) { clearAuth(); if (state.ws) state.ws.close(); setView(false); } });
  $("user-menu-logout").addEventListener("click", async () => { const ok = await confirmDialog({ title: "خروج", message: "از سیستم خارج شوید؟", confirmText: "خروج" }); if (ok) { clearAuth(); if (state.ws) state.ws.close(); setView(false); } });
  $("notif-toggle").addEventListener("click", async () => { const open = !$("notification-panel").classList.contains("open"); $("notification-panel").classList.toggle("open", open); $("notif-toggle").setAttribute("aria-expanded", String(open)); if (open) { await loadNotifications(); renderNotifPanel(); } });
  $("user-menu-btn").addEventListener("click", () => { const open = !$("user-menu").classList.contains("open"); $("user-menu").classList.toggle("open", open); $("user-menu-btn").setAttribute("aria-expanded", String(open)); });
  document.addEventListener("click", (e) => { if (!e.target.closest(".action-menu")) document.querySelectorAll(".action-list.open").forEach((x) => x.classList.remove("open")); if (!e.target.closest(".user-menu-wrap") && !e.target.closest("#notif-toggle") && !e.target.closest("#notification-panel")) closePopovers(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") { closePopovers(); closeDrawer(); toggleSidebar(false); } });
  $("global-search").addEventListener("input", debounce(async (e) => { state.filters.search = e.target.value.trim(); state.pageNo = 1; if (state.page !== "activities") setPage("activities"); else await renderActivities(); }, 260));
  $("login-form").addEventListener("submit", async (e) => { e.preventDefault(); const u = $("username").value.trim(); const p = $("password").value; if (!u || !p) return toast("نام کاربری و رمز عبور ضروری است", "error"); const btn = $("login-form").querySelector("button[type='submit']"); btn.disabled = true; try { const data = await api.post("/api/auth/login", { username: u, password: p }); saveAuth(data); await loadMe(); applyRoleUi(); setView(true); await loadMeta(); await loadNotifications(); renderNotifPanel(); connectWs(); setPage("dashboard"); toast("ورود موفق بود", "success"); } catch (err) { toast(err.message || "ورود ناموفق", "error"); } finally { btn.disabled = false; } });
  window.addEventListener("resize", () => { if (window.innerWidth >= 980) toggleSidebar(false); });
}
async function bootstrap() {
  setIcons(); initThemeToggle($("theme-toggle")); bindEvents();
  const auth = getAuth(); if (!auth?.access_token) return setView(false);
  try { await loadMe(); applyRoleUi(); setView(true); await loadMeta(); await loadNotifications(); renderNotifPanel(); connectWs(); setPage("dashboard"); } catch { clearAuth(); setView(false); }
}
bootstrap();

