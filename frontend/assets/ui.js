const ICONS = {
  bell: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M15 18H9"/><path d="M5 17h14l-1.2-1.6a3.1 3.1 0 0 1-.6-1.8V10a5.2 5.2 0 1 0-10.4 0v3.6c0 .7-.2 1.3-.6 1.8L5 17Z"/></svg>',
  search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.2-3.2"/></svg>',
  plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 5v14M5 12h14"/></svg>',
  edit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="m4 20 4.5-1 9.6-9.6a1.8 1.8 0 0 0 0-2.6l-.9-.9a1.8 1.8 0 0 0-2.6 0L5 15.5 4 20Z"/></svg>',
  trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 12h10l1-12M9 7V5h6v2"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="m5 13 4 4L19 7"/></svg>',
  user: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="8" r="4"/><path d="M4 20a8 8 0 0 1 16 0"/></svg>',
  menu: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 7h16M4 12h16M4 17h16"/></svg>',
  more: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/></svg>'
};

function icon(name, label = "") {
  const svg = ICONS[name] || "";
  return `<span class="icon" aria-hidden="${label ? "false" : "true"}">${svg}</span>${label || ""}`;
}

function escapeHtml(text = "") {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function applyTheme(theme) {
  if (theme) document.documentElement.setAttribute("data-theme", theme);
  else document.documentElement.removeAttribute("data-theme");
}

function initThemeToggle(buttonEl) {
  const key = "tt_theme";
  const initial = localStorage.getItem(key) || "";
  applyTheme(initial);

  const renderText = () => {
    const current = document.documentElement.getAttribute("data-theme");
    buttonEl.textContent = current === "dark" ? "حالت روز" : "حالت شب";
  };

  renderText();

  buttonEl.addEventListener("click", () => {
    const current = document.documentElement.getAttribute("data-theme");
    const next = current === "dark" ? "light" : "dark";
    localStorage.setItem(key, next);
    applyTheme(next);
    renderText();
  });
}

function toast(message, type = "info", timeout = 3200) {
  const region = document.getElementById("toast-region");
  if (!region) return;
  const node = document.createElement("div");
  node.className = `toast ${type}`;
  node.textContent = message;
  region.appendChild(node);
  requestAnimationFrame(() => node.classList.add("show"));
  setTimeout(() => {
    node.classList.remove("show");
    setTimeout(() => node.remove(), 220);
  }, timeout);
}

let modalResolver = null;

function closeModal(result = null) {
  const root = document.getElementById("modal-root");
  if (!root) return;
  root.innerHTML = "";
  root.className = "";
  document.removeEventListener("keydown", onModalEscape);
  if (modalResolver) {
    const r = modalResolver;
    modalResolver = null;
    r(result);
  }
}

function onModalEscape(e) {
  if (e.key === "Escape") closeModal(false);
}

function openModal({ title, content, actions = [] }) {
  const root = document.getElementById("modal-root");
  root.className = "modal-root";
  root.innerHTML = `
    <div class="overlay" data-close="1"></div>
    <section class="modal" role="dialog" aria-modal="true" aria-label="${escapeHtml(title)}">
      <header class="modal-head">
        <h3>${escapeHtml(title)}</h3>
        <button class="btn btn-icon btn-ghost" type="button" data-close="1" aria-label="بستن">×</button>
      </header>
      <div class="modal-body">${content}</div>
      <footer class="modal-foot">
        <div class="tabs">
          ${actions
            .map(
              (a, i) =>
                `<button class="btn ${a.variant || "btn-primary"}" type="button" data-action="${i}" ${a.disabled ? "disabled" : ""}>${escapeHtml(a.label)}</button>`
            )
            .join("")}
        </div>
      </footer>
    </section>
  `;

  document.addEventListener("keydown", onModalEscape);

  return new Promise((resolve) => {
    modalResolver = resolve;

    root.querySelectorAll("[data-close='1']").forEach((el) => el.addEventListener("click", () => closeModal(false)));
    root.querySelectorAll("[data-action]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const action = actions[Number(btn.dataset.action)];
        if (!action) return closeModal(true);
        if (typeof action.onClick === "function") {
          const result = await action.onClick();
          if (result === false) return;
        }
        closeModal(action.value ?? true);
      });
    });

    root.querySelector("button")?.focus();
  });
}

function confirmDialog({ title, message, confirmText = "تایید", cancelText = "انصراف", danger = false }) {
  return openModal({
    title,
    content: `<p>${escapeHtml(message)}</p>`,
    actions: [
      { label: cancelText, variant: "btn-secondary", value: false },
      { label: confirmText, variant: danger ? "btn-danger" : "btn-primary", value: true }
    ]
  });
}

function closeDrawer() {
  const root = document.getElementById("drawer-root");
  if (!root) return;
  root.innerHTML = "";
  root.className = "";
  document.removeEventListener("keydown", onDrawerEscape);
}

function onDrawerEscape(e) {
  if (e.key === "Escape") closeDrawer();
}

function openDrawer({ title, content }) {
  const root = document.getElementById("drawer-root");
  root.className = "drawer-root";
  root.innerHTML = `
    <div class="overlay" data-close="1"></div>
    <aside class="drawer" role="dialog" aria-modal="true" aria-label="${escapeHtml(title)}">
      <header class="modal-head">
        <h3>${escapeHtml(title)}</h3>
        <button class="btn btn-icon btn-ghost" type="button" data-close="1" aria-label="بستن">×</button>
      </header>
      <div class="drawer-body">${content}</div>
    </aside>
  `;

  const drawer = root.querySelector(".drawer");
  requestAnimationFrame(() => drawer?.classList.add("open"));
  document.addEventListener("keydown", onDrawerEscape);
  root.querySelectorAll("[data-close='1']").forEach((el) => el.addEventListener("click", closeDrawer));
}

function renderTabs(container, tabs, activeValue, onChange) {
  container.innerHTML = `
    <div class="tabs" role="tablist">
      ${tabs
        .map(
          (tab) =>
            `<button type="button" role="tab" class="tab-btn ${tab.value === activeValue ? "active" : ""}" aria-selected="${tab.value === activeValue ? "true" : "false"}" data-tab="${escapeHtml(tab.value)}">${escapeHtml(tab.label)}</button>`
        )
        .join("")}
    </div>
  `;
  container.querySelectorAll("[data-tab]").forEach((btn) => {
    btn.addEventListener("click", () => onChange(btn.dataset.tab));
  });
}

function renderTable({
  container,
  columns,
  rows,
  sort,
  pagination,
  emptyMessage = "اطلاعاتی موجود نیست",
  rowActions = null,
  onSort,
  onPage,
}) {
  const header = columns
    .map((c) => {
      if (!c.sortable) return `<th>${escapeHtml(c.label)}</th>`;
      const active = sort.key === c.key;
      const arrow = !active ? "" : sort.dir === "asc" ? "↑" : "↓";
      return `<th><button type="button" class="sort-btn" data-sort="${escapeHtml(c.key)}">${escapeHtml(c.label)} ${arrow}</button></th>`;
    })
    .join("");

  const body =
    rows.length === 0
      ? `<tr><td colspan="${columns.length}" style="text-align:center;padding:24px;">${emptyStateSvg(emptyMessage)}</td></tr>`
      : rows
          .map((row, idx) => {
            const cells = columns
              .map((c) => {
                const val = typeof c.render === "function" ? c.render(row, idx) : row[c.key];
                return `<td data-label="${escapeHtml(c.label)}">${val ?? "-"}</td>`;
              })
              .join("");
            const actionsCell =
              typeof rowActions === "function"
                ? `<td data-label="اقدام">${rowActions(row, idx)}</td>`
                : "";
            return `<tr data-row-id="${row.id}">${cells}${actionsCell}</tr>`;
          })
          .join("");

  const pages = Math.max(1, Math.ceil((pagination.total || 0) / pagination.pageSize));

  container.innerHTML = `
    <div class="table-shell">
      <div class="table-wrap">
        <table class="data-table">
          <thead><tr>${header}${rowActions ? "<th>اقدام</th>" : ""}</tr></thead>
          <tbody>${body}</tbody>
        </table>
      </div>
      <div class="table-footer">
        <div class="muted">صفحه ${pagination.page} از ${pages}</div>
        <div class="tabs">
          <button class="btn btn-secondary" type="button" data-page="prev" ${pagination.page <= 1 ? "disabled" : ""}>قبلی</button>
          <button class="btn btn-secondary" type="button" data-page="next" ${pagination.page >= pages ? "disabled" : ""}>بعدی</button>
        </div>
      </div>
    </div>
  `;

  container.querySelectorAll("[data-sort]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const key = btn.dataset.sort;
      const dir = sort.key === key && sort.dir === "asc" ? "desc" : "asc";
      onSort?.(key, dir);
    });
  });

  container.querySelector("[data-page='prev']")?.addEventListener("click", () => onPage?.("prev"));
  container.querySelector("[data-page='next']")?.addEventListener("click", () => onPage?.("next"));
}

function emptyStateSvg(message) {
  return `
    <div class="empty-state">
      <svg class="empty-svg" viewBox="0 0 100 100" fill="none" aria-hidden="true">
        <rect x="16" y="20" width="68" height="60" rx="8" stroke="currentColor" opacity="0.4" />
        <line x1="28" y1="40" x2="72" y2="40" stroke="currentColor" opacity="0.4" />
        <line x1="28" y1="52" x2="64" y2="52" stroke="currentColor" opacity="0.4" />
      </svg>
      <p>${escapeHtml(message)}</p>
    </div>
  `;
}

function statusPill(status, dateIso) {
  const now = new Date();
  const d = dateIso ? new Date(dateIso) : null;
  const overdue = status === "pending" && d && d < new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (status === "done") return '<span class="status-pill done">انجام شد</span>';
  if (overdue) return '<span class="status-pill overdue">معطل</span>';
  return '<span class="status-pill pending">در انتظار</span>';
}

function skeletonCards(count = 4) {
  return `<div class="kpi-grid">${new Array(count).fill("").map(() => '<div class="skeleton card"></div>').join("")}</div>`;
}

function skeletonLines(count = 6) {
  return `<div class="card grid">${new Array(count).fill("").map(() => '<div class="skeleton line"></div>').join("")}</div>`;
}

export {
  icon,
  escapeHtml,
  initThemeToggle,
  toast,
  openModal,
  closeModal,
  confirmDialog,
  openDrawer,
  closeDrawer,
  renderTabs,
  renderTable,
  statusPill,
  skeletonCards,
  skeletonLines,
  emptyStateSvg,
};
