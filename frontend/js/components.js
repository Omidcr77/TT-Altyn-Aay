export function toast(message, type = "info") {
  const holder = document.getElementById("toast-container");
  const node = document.createElement("div");
  node.className = `toast toast-${type}`;
  node.textContent = message;
  holder.appendChild(node);
  setTimeout(() => node.remove(), 3200);
}

export function formatStatus(value) {
  return value === "done" ? "انجام شد" : "در انتظار";
}

export function statusChip(value) {
  return `<span class="status-chip ${value === "done" ? "done" : "pending"}">${formatStatus(value)}</span>`;
}

export function table(headers, rowsHtml, options = {}) {
  const cls = options.compact ? "data-table compact" : "data-table";
  return `
    <div class="table-wrap card">
      <table class="${cls}">
        <thead><tr>${headers.map((h) => `<th>${h}</th>`).join("")}</tr></thead>
        <tbody>${rowsHtml || `<tr><td colspan="${headers.length}" class="empty-cell">معلومات موجود نیست</td></tr>`}</tbody>
      </table>
    </div>
  `;
}

let modalResolver = null;

function ensureModalRoot() {
  let root = document.getElementById("modal-root");
  if (!root) {
    root = document.createElement("div");
    root.id = "modal-root";
    document.body.appendChild(root);
  }
  return root;
}

function ensureDrawerRoot() {
  let root = document.getElementById("drawer-root");
  if (!root) {
    root = document.createElement("div");
    root.id = "drawer-root";
    document.body.appendChild(root);
  }
  return root;
}

export function closeModal(result = null) {
  const root = ensureModalRoot();
  root.innerHTML = "";
  root.classList.remove("open");
  if (modalResolver) {
    const current = modalResolver;
    modalResolver = null;
    current(result);
  }
}

export function openModal({ title, content, actions = [] }) {
  const root = ensureModalRoot();
  root.innerHTML = `
    <div class="overlay"></div>
    <div class="modal card" role="dialog" aria-modal="true">
      <div class="modal-head">
        <h3>${title}</h3>
        <button class="icon-btn" data-close="1" aria-label="بستن">×</button>
      </div>
      <div class="modal-body">${content}</div>
      <div class="modal-actions">
        ${actions
          .map(
            (a, i) =>
              `<button class="${a.variant || ""}" data-modal-action="${i}">${a.label}</button>`
          )
          .join("")}
      </div>
    </div>
  `;
  root.classList.add("open");

  return new Promise((resolve) => {
    modalResolver = resolve;
    root.querySelectorAll("[data-close='1']").forEach((b) => b.addEventListener("click", () => closeModal(null)));
    root.querySelector(".overlay")?.addEventListener("click", () => closeModal(null));
    root.querySelectorAll("[data-modal-action]").forEach((b) => {
      b.addEventListener("click", () => {
        const action = actions[Number(b.dataset.modalAction)];
        if (action?.onClick) {
          const res = action.onClick();
          if (res && typeof res.then === "function") {
            res.then((v) => closeModal(v));
            return;
          }
          closeModal(res);
          return;
        }
        closeModal(action?.value ?? true);
      });
    });
  });
}

export function confirmDialog({ title, message, confirmText = "تایید", cancelText = "انصراف", danger = false }) {
  return openModal({
    title,
    content: `<p>${message}</p>`,
    actions: [
      { label: cancelText, variant: "secondary", value: false },
      { label: confirmText, variant: danger ? "danger" : "", value: true },
    ],
  });
}

export function openDrawer({ title, content }) {
  const root = ensureDrawerRoot();
  root.innerHTML = `
    <div class="overlay"></div>
    <aside class="drawer card" role="dialog" aria-modal="true">
      <div class="modal-head">
        <h3>${title}</h3>
        <button class="icon-btn" data-close="1" aria-label="بستن">×</button>
      </div>
      <div class="drawer-body">${content}</div>
    </aside>
  `;
  root.classList.add("open");
  root.querySelectorAll("[data-close='1']").forEach((b) => b.addEventListener("click", closeDrawer));
  root.querySelector(".overlay")?.addEventListener("click", closeDrawer);
}

export function closeDrawer() {
  const root = ensureDrawerRoot();
  root.innerHTML = "";
  root.classList.remove("open");
}

export function skeleton(rows = 4) {
  return `
    <div class="skeleton-wrap card">
      ${new Array(rows)
        .fill(0)
        .map(() => `<div class="skeleton-line"></div>`)
        .join("")}
    </div>
  `;
}
