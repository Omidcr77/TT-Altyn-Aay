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
    return JSON.parse(detailJson) as unknown;
  } catch {
    return null;
  }
}

export function AuditPage() {
  const { showToast } = useToast();
  const queryClient = useQueryClient();

  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<AuditItem | null>(null);
  const [undoTarget, setUndoTarget] = useState<AuditItem | null>(null);

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

  const filteredItems = useMemo(() => {
    const items = auditQuery.data?.items || [];
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((item) => {
      const blob = [
        item.id,
        item.action,
        item.entity,
        item.entity_id,
        item.username || "",
        item.detail_json || ""
      ]
        .join(" ")
        .toLowerCase();
      return blob.includes(q);
    });
  }, [auditQuery.data?.items, search]);

  const columns = useMemo<ColumnDef<AuditItem>[]>(
    () => [
      { accessorKey: "id", header: "ID" },
      { accessorKey: "created_at", header: "زمان", cell: ({ row }) => formatAuditDate(row.original.created_at) },
      { accessorKey: "username", header: "کاربر", cell: ({ row }) => row.original.username || "-" },
      { accessorKey: "action", header: "عملیات" },
      { accessorKey: "entity", header: "موجودیت" },
      { accessorKey: "entity_id", header: "شناسه" },
      {
        id: "actions",
        header: "اقدام",
        enableSorting: false,
        cell: ({ row }) => (
          <div className="flex flex-wrap gap-1">
            <button className="btn-secondary" onClick={() => setSelected(row.original)}>
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

  return (
    <section className="space-y-3">
      <header className="card p-4 flex items-center justify-between gap-2">
        <div>
          <h3 className="text-lg font-semibold">گزارش ممیزی</h3>
          <p className="text-sm text-slate-500 mt-1">تاریخچه تغییرات، بررسی جزئیات و بازگشت عملیات قابل Undo.</p>
        </div>
        <div className="text-sm text-slate-500">مجموع: {total}</div>
      </header>

      <section className="card p-3 grid grid-cols-1 md:grid-cols-[1fr_auto] gap-2">
        <input
          className="input"
          placeholder="جستجو در عملیات، کاربر، شناسه..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button className="btn-secondary" onClick={() => setSearch("")}>
          پاک‌سازی
        </button>
      </section>

      <section className="card p-3">
        {auditQuery.isLoading ? (
          <div className="text-sm text-slate-500">در حال بارگذاری ممیزی...</div>
        ) : auditQuery.isError ? (
          <div className="text-sm text-red-600">{auditQuery.error instanceof Error ? auditQuery.error.message : "خطا در دریافت ممیزی"}</div>
        ) : (
          <>
            <DataTable columns={columns} data={filteredItems} />
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
        onClose={() => setSelected(null)}
        footer={
          <button className="btn-secondary" onClick={() => setSelected(null)}>
            بستن
          </button>
        }
      >
        {selected && (
          <div className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
              <div><strong>کاربر:</strong> {selected.username || "-"}</div>
              <div><strong>عملیات:</strong> {selected.action}</div>
              <div><strong>موجودیت:</strong> {selected.entity}</div>
              <div><strong>شناسه:</strong> {selected.entity_id}</div>
              <div><strong>زمان:</strong> {formatAuditDate(selected.created_at)}</div>
              <div><strong>Undo:</strong> {selected.undoable ? "بلی" : "خیر"}</div>
            </div>
            <div>
              <p className="text-sm font-semibold mb-1">JSON جزئیات</p>
              <pre className="rounded-lg bg-slate-900 text-slate-100 p-3 overflow-auto text-xs leading-6">
                {JSON.stringify(parseDetail(selected.detail_json) ?? selected.detail_json ?? {}, null, 2)}
              </pre>
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
