import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { DataTable } from "@/components/DataTable";
import { Modal } from "@/components/Modal";
import { useToast } from "@/components/ToastProvider";
import { fetchAuditLogs, undoAudit } from "@/services/audit";
import type { AuditItem } from "@/types/audit";

function formatAuditDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("fa-AF-u-ca-gregory", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

function parseDetail(detailJson: string | null) {
  if (!detailJson) return null;
  try {
    return JSON.parse(detailJson) as Record<string, unknown>;
  } catch {
    return null;
  }
}

const fieldLabels: Record<string, string> = {
  date: "تاریخ",
  activity_type: "نوع فعالیت",
  customer_name: "نام مشتری",
  location: "موقعیت",
  address: "آدرس",
  status: "وضعیت",
  priority: "اولویت",
  report_text: "گزارش",
  device_info: "دستگاه",
  extra_fields: "فیلدهای اضافی",
  assigned_staff_ids: "کارمندان مسئول",
  done_by_user_id: "تکمیل‌کننده",
  done_at: "زمان تکمیل"
};

function explainAudit(item: AuditItem) {
  const detail = parseDetail(item.detail_json);
  const actor = item.username || "کاربر نامشخص";
  const lines: string[] = [];

  if (!detail) return [`${actor} عملیات ${item.action} را روی ${item.entity}#${item.entity_id} انجام داد.`];

  if (item.action === "create" && detail.after && typeof detail.after === "object") {
    const after = detail.after as Record<string, unknown>;
    lines.push(`${actor} یک فعالیت جدید ثبت کرد.`);
    if (after.customer_name) lines.push(`مشتری: ${String(after.customer_name)}`);
    if (after.activity_type) lines.push(`نوع فعالیت: ${String(after.activity_type)}`);
    if (after.location) lines.push(`موقعیت: ${String(after.location)}`);
    return lines;
  }

  if (item.action === "update") {
    lines.push(`${actor} اطلاعات فعالیت را ویرایش کرد.`);
    const changed = Array.isArray(detail.changed_fields) ? detail.changed_fields.map(String) : [];
    if (changed.length) {
      lines.push(`فیلدهای تغییر یافته: ${changed.map((f) => fieldLabels[f] || f).join("، ")}`);
    }
    return lines;
  }

  if (item.action === "delete") {
    return [`${actor} این فعالیت را حذف کرد.`];
  }

  if (item.action === "mark_done") {
    return [`${actor} وضعیت فعالیت را «انجام شد» کرد.`];
  }

  if (item.action.startsWith("bulk_")) {
    const action = String((detail as Record<string, unknown>).action || item.action);
    return [`${actor} عملیات گروهی «${action}» را اجرا کرد.`];
  }

  if (item.action.startsWith("undo_")) {
    return [`${actor} عملیات قبلی را بازگشت داد.`];
  }

  return [`${actor} عملیات ${item.action} را روی ${item.entity}#${item.entity_id} انجام داد.`];
}

function relativeTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "همین حالا";
  if (mins < 60) return `${mins} دقیقه قبل`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} ساعت قبل`;
  const days = Math.floor(hours / 24);
  return `${days} روز قبل`;
}

export function AuditPage() {
  const { showToast } = useToast();
  const queryClient = useQueryClient();

  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("all");
  const [entityFilter, setEntityFilter] = useState("all");
  const [userFilter, setUserFilter] = useState("all");
  const [undoOnly, setUndoOnly] = useState(false);
  const [selected, setSelected] = useState<AuditItem | null>(null);
  const [undoTarget, setUndoTarget] = useState<AuditItem | null>(null);
  const [showRawJson, setShowRawJson] = useState(false);

  const auditQuery = useQuery({
    queryKey: ["audit", page, pageSize],
    queryFn: () => fetchAuditLogs(page, pageSize)
  });

  const undoMutation = useMutation({
    mutationFn: (auditId: number) => undoAudit(auditId),
    onSuccess: (res) => {
      showToast(`بازگشت عملیات انجام شد (فعالیت #${res.activity_id})`, "success");
      setUndoTarget(null);
      void queryClient.invalidateQueries({ queryKey: ["audit"] });
      void queryClient.invalidateQueries({ queryKey: ["activities"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
    },
    onError: (error) => {
      showToast(error instanceof Error ? error.message : "بازگشت عملیات ناکام شد", "error");
    }
  });

  const allItems = auditQuery.data?.items || [];

  const options = useMemo(() => {
    const actions = Array.from(new Set(allItems.map((x) => x.action))).sort();
    const entities = Array.from(new Set(allItems.map((x) => x.entity))).sort();
    const users = Array.from(new Set(allItems.map((x) => x.username || "-")).values()).sort();
    return { actions, entities, users };
  }, [allItems]);

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allItems.filter((item) => {
      if (actionFilter !== "all" && item.action !== actionFilter) return false;
      if (entityFilter !== "all" && item.entity !== entityFilter) return false;
      if (userFilter !== "all" && (item.username || "-") !== userFilter) return false;
      if (undoOnly && !item.undoable) return false;

      if (!q) return true;
      const blob = [item.id, item.action, item.entity, item.entity_id, item.username || "", item.detail_json || ""]
        .join(" ")
        .toLowerCase();
      return blob.includes(q);
    });
  }, [allItems, search, actionFilter, entityFilter, userFilter, undoOnly]);

  const stats = useMemo(() => {
    const total = filteredItems.length;
    const undoable = filteredItems.filter((x) => x.undoable).length;
    const userCount = new Set(filteredItems.map((x) => x.username || "-")).size;
    const actionCount = new Set(filteredItems.map((x) => x.action)).size;
    return { total, undoable, userCount, actionCount };
  }, [filteredItems]);

  const columns = useMemo<ColumnDef<AuditItem>[]>(
    () => [
      { accessorKey: "id", header: "ID" },
      {
        accessorKey: "created_at",
        header: "زمان",
        cell: ({ row }) => (
          <div>
            <div>{formatAuditDate(row.original.created_at)}</div>
            <div className="text-xs text-slate-500">{relativeTime(row.original.created_at)}</div>
          </div>
        )
      },
      { accessorKey: "username", header: "کاربر", cell: ({ row }) => row.original.username || "-" },
      {
        accessorKey: "action",
        header: "عملیات",
        cell: ({ row }) => <span className="rounded-full bg-indigo-100 text-indigo-700 px-2 py-0.5 text-xs">{row.original.action}</span>
      },
      {
        accessorKey: "entity",
        header: "موجودیت",
        cell: ({ row }) => <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs">{row.original.entity}</span>
      },
      { accessorKey: "entity_id", header: "شناسه" },
      {
        id: "actions",
        header: "اقدام",
        enableSorting: false,
        cell: ({ row }) => (
          <div className="flex flex-wrap gap-1">
            <button
              className="btn-secondary"
              onClick={() => {
                setShowRawJson(false);
                setSelected(row.original);
              }}
            >
              جزئیات
            </button>
            {row.original.undoable && (
              <button className="btn-primary" onClick={() => setUndoTarget(row.original)}>
                بازگشت
              </button>
            )}
          </div>
        )
      }
    ],
    []
  );

  const total = auditQuery.data?.total ?? 0;

  function clearFilters() {
    setSearch("");
    setActionFilter("all");
    setEntityFilter("all");
    setUserFilter("all");
    setUndoOnly(false);
  }

  function exportJson() {
    const blob = new Blob([JSON.stringify(filteredItems, null, 2)], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit-page-${page}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="space-y-3">
      <header className="card p-4 flex items-center justify-between gap-2">
        <div>
          <h3 className="text-lg font-semibold">گزارش ممیزی</h3>
          <p className="text-sm text-slate-500 mt-1">تاریخچه تغییرات، بررسی جزئیات و بازگشت عملیات قابل Undo.</p>
        </div>
        <div className="text-sm text-slate-500">مجموع کل: {total}</div>
      </header>

      <section className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <div className="card p-3">
          <div className="text-xs text-slate-500">رکوردهای فیلترشده</div>
          <div className="text-2xl font-bold">{stats.total}</div>
        </div>
        <div className="card p-3">
          <div className="text-xs text-slate-500">قابل بازگشت</div>
          <div className="text-2xl font-bold text-indigo-700">{stats.undoable}</div>
        </div>
        <div className="card p-3">
          <div className="text-xs text-slate-500">کاربران فعال</div>
          <div className="text-2xl font-bold">{stats.userCount}</div>
        </div>
        <div className="card p-3">
          <div className="text-xs text-slate-500">انواع عملیات</div>
          <div className="text-2xl font-bold">{stats.actionCount}</div>
        </div>
      </section>

      <section className="card p-3 grid grid-cols-1 md:grid-cols-6 gap-2">
        <input
          className="input md:col-span-2"
          placeholder="جستجو در عملیات، کاربر، شناسه..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <select className="input" value={actionFilter} onChange={(e) => setActionFilter(e.target.value)}>
          <option value="all">همه عملیات</option>
          {options.actions.map((x) => (
            <option key={x} value={x}>
              {x}
            </option>
          ))}
        </select>

        <select className="input" value={entityFilter} onChange={(e) => setEntityFilter(e.target.value)}>
          <option value="all">همه موجودیت‌ها</option>
          {options.entities.map((x) => (
            <option key={x} value={x}>
              {x}
            </option>
          ))}
        </select>

        <select className="input" value={userFilter} onChange={(e) => setUserFilter(e.target.value)}>
          <option value="all">همه کاربران</option>
          {options.users.map((x) => (
            <option key={x} value={x}>
              {x}
            </option>
          ))}
        </select>

        <div className="flex items-center gap-2">
          <label className="inline-flex items-center gap-2 text-sm">
            <input type="checkbox" checked={undoOnly} onChange={(e) => setUndoOnly(e.target.checked)} />
            فقط Undo
          </label>
        </div>

        <div className="md:col-span-6 flex flex-wrap gap-2">
          <button className="btn-secondary" onClick={clearFilters}>
            پاک‌سازی فیلترها
          </button>
          <button className="btn-secondary" onClick={exportJson}>
            خروجی JSON
          </button>
        </div>
      </section>

      <section className="card p-3">
        {auditQuery.isLoading ? (
          <div className="text-sm text-slate-500">در حال بارگذاری ممیزی...</div>
        ) : auditQuery.isError ? (
          <div className="text-sm text-red-600">{auditQuery.error instanceof Error ? auditQuery.error.message : "خطا در دریافت ممیزی"}</div>
        ) : (
          <>
            <DataTable
              columns={columns}
              data={filteredItems}
              getRowClassName={(row) => (row.undoable ? "bg-indigo-50/40" : undefined)}
            />
            <div className="mt-3 flex items-center gap-2">
              <button className="btn-secondary" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                قبلی
              </button>
              <span className="text-sm text-slate-600">صفحه {page}</span>
              <button
                className="btn-secondary"
                disabled={(auditQuery.data?.items?.length || 0) < pageSize}
                onClick={() => setPage((p) => p + 1)}
              >
                بعدی
              </button>
            </div>
          </>
        )}
      </section>

      <Modal
        open={!!selected}
        title={selected ? `جزئیات ممیزی #${selected.id}` : "جزئیات"}
        onClose={() => {
          setSelected(null);
          setShowRawJson(false);
        }}
        footer={
          <div className="flex gap-2">
            <button className="btn-secondary" onClick={() => setShowRawJson((v) => !v)}>
              {showRawJson ? "نمایش توضیح" : "نمایش JSON خام"}
            </button>
            <button
              className="btn-secondary"
              onClick={() => {
                setSelected(null);
                setShowRawJson(false);
              }}
            >
              بستن
            </button>
          </div>
        }
      >
        {selected && (
          <div className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
              <div>
                <strong>کاربر:</strong> {selected.username || "-"}
              </div>
              <div>
                <strong>عملیات:</strong> {selected.action}
              </div>
              <div>
                <strong>موجودیت:</strong> {selected.entity}
              </div>
              <div>
                <strong>شناسه:</strong> {selected.entity_id}
              </div>
              <div>
                <strong>زمان:</strong> {formatAuditDate(selected.created_at)}
              </div>
              <div>
                <strong>Undo:</strong> {selected.undoable ? "بلی" : "خیر"}
              </div>
            </div>
            <div>
              {!showRawJson ? (
                <>
                  <p className="text-sm font-semibold mb-1">توضیح عملیات</p>
                  <ul className="list-disc pr-5 text-sm space-y-1">
                    {explainAudit(selected).map((line, idx) => (
                      <li key={idx}>{line}</li>
                    ))}
                  </ul>
                </>
              ) : (
                <>
                  <p className="text-sm font-semibold mb-1">JSON جزئیات</p>
                  <pre className="rounded-lg bg-slate-900 text-slate-100 p-3 overflow-auto text-xs leading-6">
                    {JSON.stringify(parseDetail(selected.detail_json) ?? selected.detail_json ?? {}, null, 2)}
                  </pre>
                </>
              )}
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={!!undoTarget}
        title="بازگشت عملیات"
        message={undoTarget ? `عملیات "${undoTarget.action}" برای موجودیت #${undoTarget.entity_id} بازگردانده شود؟` : ""}
        onCancel={() => setUndoTarget(null)}
        onConfirm={() => {
          if (undoTarget) undoMutation.mutate(undoTarget.id);
        }}
      />
    </section>
  );
}
