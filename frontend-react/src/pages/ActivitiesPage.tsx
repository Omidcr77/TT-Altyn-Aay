import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "@/app/AuthContext";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { DataTable } from "@/components/DataTable";
import { Modal } from "@/components/Modal";
import { useToast } from "@/components/ToastProvider";
import {
  bulkActivityAction,
  deleteActivity,
  fetchActivities,
  fetchActivity,
  markDone,
  updateActivity
} from "@/services/activities";
import {
  downloadCsv,
  downloadExcel,
  downloadExcelTemplate,
  importExcel,
  validateExcelImport
} from "@/services/exports";
import { fetchStaff } from "@/services/staff";
import type { Activity, ActivityUpdatePayload } from "@/types/activity";
import type { ExcelValidateResult } from "@/types/export";

type BulkAction = "set_status" | "assign_staff" | "set_priority" | "delete";

function statusText(status: string) {
  return status === "done" ? "انجام شد" : "در انتظار";
}

function useDebouncedValue<T>(value: T, delayMs: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(id);
  }, [value, delayMs]);
  return debounced;
}

export function ActivitiesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { role } = useAuth();
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const isAdmin = role === "admin";
  const canManage = role === "admin" || role === "manager";

  const initialTab = searchParams.get("tab") === "done" ? "done" : "pending";
  const initialPage = Math.max(1, Number(searchParams.get("page") || "1") || 1);
  const [tab, setTab] = useState<"pending" | "done">(initialTab);
  const [page, setPage] = useState(initialPage);
  const [pageSize] = useState(15);
  const [search, setSearch] = useState(searchParams.get("search") || "");
  const [dateFrom, setDateFrom] = useState(searchParams.get("dateFrom") || "");
  const [dateTo, setDateTo] = useState(searchParams.get("dateTo") || "");
  const [staffId, setStaffId] = useState(searchParams.get("staffId") || "");
  const [customer, setCustomer] = useState(searchParams.get("customer") || "");
  const [focusActivityId, setFocusActivityId] = useState<number | null>(() => {
    const raw = Number(searchParams.get("activityId") || "0");
    return raw > 0 ? raw : null;
  });

  const debouncedSearch = useDebouncedValue(search, 300);
  const debouncedCustomer = useDebouncedValue(customer, 300);

  const [selected, setSelected] = useState<Activity | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Activity | null>(null);
  const [doneTarget, setDoneTarget] = useState<Activity | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editDraft, setEditDraft] = useState<ActivityUpdatePayload>({});

  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [bulkActionType, setBulkActionType] = useState<BulkAction>("set_status");
  const [bulkStatus, setBulkStatus] = useState<"pending" | "done">("pending");
  const [bulkPriority, setBulkPriority] = useState(0);
  const [bulkStaffIds, setBulkStaffIds] = useState<number[]>([]);
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);

  const [importOpen, setImportOpen] = useState(false);
  const [importMode, setImportMode] = useState<"insert" | "upsert">("upsert");
  const [importFile, setImportFile] = useState<File | null>(null);
  const [validateResult, setValidateResult] = useState<ExcelValidateResult | null>(null);

  useEffect(() => {
    setSelectedIds([]);
  }, [tab, page, search, dateFrom, dateTo, staffId, customer]);

  useEffect(() => {
    const params = new URLSearchParams();
    params.set("tab", tab);
    params.set("page", String(page));
    if (search.trim()) params.set("search", search.trim());
    if (dateFrom) params.set("dateFrom", dateFrom);
    if (dateTo) params.set("dateTo", dateTo);
    if (staffId) params.set("staffId", staffId);
    if (customer.trim()) params.set("customer", customer.trim());
    if (focusActivityId) params.set("activityId", String(focusActivityId));
    setSearchParams(params, { replace: true });
  }, [tab, page, search, dateFrom, dateTo, staffId, customer, focusActivityId, setSearchParams]);

  useEffect(() => {
    if (!focusActivityId) return;
    void (async () => {
      try {
        const target = await fetchActivity(focusActivityId);
        setTab(target.status);
        setPage(1);
        setCustomer(target.customer_name);
      } catch {
        // no-op if target no longer exists
      }
    })();
  }, [focusActivityId]);

  const activitiesQuery = useQuery({
    queryKey: ["activities", { tab, page, pageSize, search: debouncedSearch, dateFrom, dateTo, staffId, customer: debouncedCustomer }],
    queryFn: () => fetchActivities({ page, pageSize, status: tab, search: debouncedSearch, dateFrom, dateTo, staffId, customer: debouncedCustomer })
  });

  const staffQuery = useQuery({
    queryKey: ["staff-options"],
    queryFn: fetchStaff
  });

  const doneMutation = useMutation({
    mutationFn: (id: number) => markDone(id),
    onSuccess: () => {
      showToast("فعالیت انجام شد", "success");
      void queryClient.invalidateQueries({ queryKey: ["activities"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
    },
    onError: (err) => showToast(err instanceof Error ? err.message : "خطا در تغییر وضعیت", "error")
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteActivity(id),
    onSuccess: () => {
      showToast("فعالیت حذف شد", "success");
      setDeleteTarget(null);
      void queryClient.invalidateQueries({ queryKey: ["activities"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
    },
    onError: (err) => showToast(err instanceof Error ? err.message : "خطا در حذف", "error")
  });

  const editMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: ActivityUpdatePayload }) => updateActivity(id, payload),
    onSuccess: () => {
      showToast("ویرایش ذخیره شد", "success");
      setEditOpen(false);
      setSelected(null);
      void queryClient.invalidateQueries({ queryKey: ["activities"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
    },
    onError: (err) => showToast(err instanceof Error ? err.message : "خطا در ویرایش", "error")
  });

  const bulkMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) => bulkActivityAction(payload),
    onSuccess: (res) => {
      showToast(`عملیات گروهی انجام شد (${res.updated + res.deleted}/${res.total})`, "success");
      setSelectedIds([]);
      void queryClient.invalidateQueries({ queryKey: ["activities"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
    },
    onError: (err) => showToast(err instanceof Error ? err.message : "عملیات گروهی ناکام شد", "error")
  });

  const validateImportMutation = useMutation({
    mutationFn: (file: File) => validateExcelImport(file),
    onSuccess: (result) => {
      setValidateResult(result);
      if (result.valid) showToast("فایل معتبر است", "success");
      else showToast(`فایل دارای ${result.error_rows} سطر خطا است`, "error");
    },
    onError: (err) => showToast(err instanceof Error ? err.message : "اعتبارسنجی فایل ناکام شد", "error")
  });

  const importMutation = useMutation({
    mutationFn: ({ file, mode }: { file: File; mode: "insert" | "upsert" }) => importExcel(file, mode),
    onSuccess: (res) => {
      showToast(`واردسازی انجام شد: ایجاد ${res.created} / به‌روزرسانی ${res.updated}`, "success");
      setImportOpen(false);
      setImportFile(null);
      setValidateResult(null);
      void queryClient.invalidateQueries({ queryKey: ["activities"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
    },
    onError: (err) => showToast(err instanceof Error ? err.message : "واردسازی ناکام شد", "error")
  });

  async function onOpenEdit(id: number) {
    try {
      const full = await fetchActivity(id);
      setSelected(full);
      setEditDraft({
        date: full.date,
        activity_type: full.activity_type,
        customer_name: full.customer_name,
        location: full.location,
        address: full.address || "",
        device_info: full.device_info || "",
        report_text: full.report_text || "",
        priority: full.priority,
        status: full.status,
        assigned_staff_ids: full.assigned_staff.map((x) => x.id)
      });
      setEditOpen(true);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "خطا در بارگذاری فعالیت", "error");
    }
  }

  const total = activitiesQuery.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const items = activitiesQuery.data?.items ?? [];
  const visibleIds = items.map((item) => item.id);
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.includes(id));

  const columns = useMemo<ColumnDef<Activity>[]>(() => {
    const base: ColumnDef<Activity>[] = [
      { accessorKey: "id", header: "ID" },
      { accessorKey: "date", header: "تاریخ", cell: (ctx) => <span>{String(ctx.getValue())}</span> },
      { accessorKey: "customer_name", header: "مشتری" },
      {
        id: "actors",
        header: "چه کسی انجام داد",
        cell: ({ row }) => (
          <div className="text-xs leading-5">
            <div>
              <span className="text-slate-500">ثبت: </span>
              <span>{row.original.created_by_username || row.original.created_by_user_id || "-"}</span>
            </div>
            {row.original.done_by_user_id && (
              <div>
                <span className="text-slate-500">تکمیل: </span>
                <span>{row.original.done_by_username || row.original.done_by_user_id}</span>
              </div>
            )}
          </div>
        )
      },
      { accessorKey: "activity_type", header: "نوع فعالیت" },
      { accessorKey: "location", header: "موقعیت" },
      {
        id: "assigned_staff",
        header: "کارمند",
        cell: ({ row }) => row.original.assigned_staff.map((s) => s.name).join("، ") || "-"
      },
      {
        accessorKey: "status",
        header: "وضعیت",
        cell: ({ row }) => (
          <span
            className={`inline-flex rounded-full px-2 py-1 text-xs ${row.original.status === "done" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}
            aria-label={`وضعیت: ${statusText(row.original.status)}`}
          >
            {statusText(row.original.status)}
          </span>
        )
      },
      {
        id: "actions",
        header: "اقدام",
        enableSorting: false,
        cell: ({ row }) => (
          <div className="flex flex-wrap gap-1">
            <button className="btn-secondary" onClick={() => void onOpenEdit(row.original.id)}>
              ویرایش
            </button>
            {isAdmin && row.original.status !== "done" && (
              <button className="btn-primary" onClick={() => setDoneTarget(row.original)}>
                انجام شد
              </button>
            )}
            {isAdmin && (
              <button className="btn-danger" onClick={() => setDeleteTarget(row.original)}>
                حذف
              </button>
            )}
          </div>
        )
      }
    ];

    if (!canManage) return base;

    return [
      {
        id: "select",
        header: () => (
          <input
            type="checkbox"
            aria-label="انتخاب تمام ردیف های صفحه"
            checked={allVisibleSelected}
            onChange={(e) => {
              if (e.target.checked) {
                setSelectedIds((prev) => [...new Set([...prev, ...visibleIds])]);
              } else {
                setSelectedIds((prev) => prev.filter((id) => !visibleIds.includes(id)));
              }
            }}
          />
        ),
        cell: ({ row }) => (
          <input
            type="checkbox"
            aria-label={`انتخاب فعالیت ${row.original.id}`}
            checked={selectedIds.includes(row.original.id)}
            onChange={(e) => {
              setSelectedIds((prev) =>
                e.target.checked ? [...new Set([...prev, row.original.id])] : prev.filter((x) => x !== row.original.id)
              );
            }}
          />
        )
      },
      ...base
    ];
  }, [allVisibleSelected, canManage, isAdmin, selectedIds, visibleIds]);

  async function handleBulkRun() {
    if (!selectedIds.length) {
      showToast("حداقل یک فعالیت انتخاب کنید", "error");
      return;
    }
    if (bulkActionType === "delete") {
      setConfirmBulkDelete(true);
      return;
    }

    if (bulkActionType === "set_status") {
      bulkMutation.mutate({ action: "set_status", ids: selectedIds, status: bulkStatus });
      return;
    }
    if (bulkActionType === "assign_staff") {
      bulkMutation.mutate({ action: "assign_staff", ids: selectedIds, staff_ids: bulkStaffIds });
      return;
    }
    bulkMutation.mutate({ action: "set_priority", ids: selectedIds, priority: bulkPriority });
  }

  return (
    <section className="space-y-3">
      {focusActivityId && (
        <div className="card p-3 border-brand-200 bg-brand-50 flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-brand-900">در حال نمایش فعالیت شماره {focusActivityId}</p>
          <button className="btn-secondary" onClick={() => setFocusActivityId(null)}>
            پاک کردن تمرکز
          </button>
        </div>
      )}

      <div className="card p-3 flex flex-wrap gap-2 items-center justify-between">
        <div className="flex gap-2">
          <button className={tab === "pending" ? "btn-primary" : "btn-secondary"} onClick={() => { setTab("pending"); setPage(1); }}>
            در انتظار
          </button>
          <button className={tab === "done" ? "btn-primary" : "btn-secondary"} onClick={() => { setTab("done"); setPage(1); }}>
            انجام شد
          </button>
        </div>
        <div className="text-sm text-slate-500">جمع: {total}</div>
      </div>

      <div className="card p-3 grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-2">
        <input className="input" placeholder="جستجو" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        <input className="input" type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1); }} />
        <input className="input" type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1); }} />
        <select className="input" value={staffId} onChange={(e) => { setStaffId(e.target.value); setPage(1); }}>
          <option value="">تمام کارمندان</option>
          {(staffQuery.data || [])
            .filter((s) => s.active !== false)
            .map((s) => (
              <option key={s.id} value={String(s.id)}>
                {s.name}
              </option>
            ))}
        </select>
        <input className="input" placeholder="نام مشتری" value={customer} onChange={(e) => { setCustomer(e.target.value); setPage(1); }} />
        <button
          className="btn-secondary"
          onClick={() => {
            setSearch("");
            setDateFrom("");
            setDateTo("");
            setStaffId("");
            setCustomer("");
            setFocusActivityId(null);
            setPage(1);
          }}
        >
          پاک‌سازی
        </button>
      </div>

      <div className="card p-3 space-y-3">
        <div className="flex flex-wrap gap-2">
          <button className="btn-secondary" onClick={() => void downloadCsv().catch((e) => showToast(e instanceof Error ? e.message : "خطا", "error"))}>
            خروجی CSV
          </button>
          <button className="btn-secondary" onClick={() => void downloadExcel().catch((e) => showToast(e instanceof Error ? e.message : "خطا", "error"))}>
            خروجی Excel
          </button>
          <button className="btn-secondary" onClick={() => void downloadExcelTemplate().catch((e) => showToast(e instanceof Error ? e.message : "خطا", "error"))}>
            قالب واردسازی
          </button>
          {canManage && (
            <button className="btn-primary" onClick={() => setImportOpen(true)}>
              واردسازی Excel
            </button>
          )}
        </div>

        {canManage && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-2 items-start">
            <div>
              <label className="text-xs text-slate-500">عملیات گروهی</label>
              <select className="input mt-1" value={bulkActionType} onChange={(e) => setBulkActionType(e.target.value as BulkAction)}>
                <option value="set_status">تغییر وضعیت</option>
                <option value="assign_staff">تعیین کارمند</option>
                <option value="set_priority">تغییر اولویت</option>
                <option value="delete">حذف گروهی</option>
              </select>
            </div>

            {bulkActionType === "set_status" && (
              <div>
                <label className="text-xs text-slate-500">وضعیت</label>
                <select className="input mt-1" value={bulkStatus} onChange={(e) => setBulkStatus(e.target.value as "pending" | "done")}>
                  <option value="pending">در انتظار</option>
                  <option value="done">انجام شد</option>
                </select>
              </div>
            )}

            {bulkActionType === "assign_staff" && (
              <div className="xl:col-span-2">
                <label className="text-xs text-slate-500">کارمندان</label>
                <div className="mt-1 border border-slate-300 rounded-lg p-2 grid grid-cols-2 gap-2 max-h-32 overflow-auto">
                  {(staffQuery.data || [])
                    .filter((s) => s.active !== false)
                    .map((s) => {
                      const checked = bulkStaffIds.includes(s.id);
                      return (
                        <label key={s.id} className="text-xs inline-flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => {
                              setBulkStaffIds((prev) =>
                                e.target.checked ? [...new Set([...prev, s.id])] : prev.filter((id) => id !== s.id)
                              );
                            }}
                          />
                          {s.name}
                        </label>
                      );
                    })}
                </div>
              </div>
            )}

            {bulkActionType === "set_priority" && (
              <div>
                <label className="text-xs text-slate-500">اولویت</label>
                <input
                  className="input mt-1"
                  type="number"
                  min={0}
                  max={1000}
                  value={bulkPriority}
                  onChange={(e) => setBulkPriority(Number(e.target.value || 0))}
                />
              </div>
            )}

            <div className="flex items-end gap-2">
              <button className="btn-primary" disabled={bulkMutation.isPending} onClick={() => void handleBulkRun()}>
                اجرا روی {selectedIds.length} مورد
              </button>
              <button className="btn-secondary" onClick={() => setSelectedIds([])}>
                پاک انتخاب
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="card p-3">
        {activitiesQuery.isLoading ? (
          <div className="space-y-2 animate-pulse">
            {Array.from({ length: 6 }).map((_, idx) => (
              <div key={idx} className="h-10 rounded border border-slate-200 bg-slate-100" />
            ))}
          </div>
        ) : activitiesQuery.isError ? (
          <div className="text-red-600">{activitiesQuery.error instanceof Error ? activitiesQuery.error.message : "خطا در دریافت لیست"}</div>
        ) : (
          <>
            <DataTable
              columns={columns}
              data={items}
              getRowClassName={(row) => (focusActivityId && row.id === focusActivityId ? "bg-brand-50" : undefined)}
            />
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button className="btn-secondary" disabled={page <= 1} onClick={() => setPage(1)}>
                اول
              </button>
              <button className="btn-secondary" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                قبلی
              </button>
              <span className="text-sm text-slate-600">
                صفحه {page} از {totalPages}
              </span>
              <button className="btn-secondary" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>
                بعدی
              </button>
              <button className="btn-secondary" disabled={page >= totalPages} onClick={() => setPage(totalPages)}>
                آخر
              </button>
              <span className="text-xs text-slate-500">
                نمایش {(page - 1) * pageSize + (items.length ? 1 : 0)} تا {(page - 1) * pageSize + items.length} از {total}
              </span>
            </div>
          </>
        )}
      </div>

      <ConfirmDialog
        open={!!doneTarget}
        title="تغییر وضعیت"
        message="این فعالیت انجام شد ثبت شود؟"
        onCancel={() => setDoneTarget(null)}
        onConfirm={() => {
          if (doneTarget) doneMutation.mutate(doneTarget.id);
          setDoneTarget(null);
        }}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        title="حذف فعالیت"
        message="این فعالیت حذف شود؟"
        danger
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) deleteMutation.mutate(deleteTarget.id);
        }}
      />

      <ConfirmDialog
        open={confirmBulkDelete}
        title="حذف گروهی"
        message={`تعداد ${selectedIds.length} فعالیت حذف شود؟`}
        danger
        onCancel={() => setConfirmBulkDelete(false)}
        onConfirm={() => {
          bulkMutation.mutate({ action: "delete", ids: selectedIds });
          setConfirmBulkDelete(false);
        }}
      />

      <Modal
        open={editOpen}
        title="ویرایش فعالیت"
        onClose={() => setEditOpen(false)}
        footer={
          <>
            <button className="btn-secondary" onClick={() => setEditOpen(false)}>
              انصراف
            </button>
            <button
              className="btn-primary"
              onClick={() => {
                if (!selected) return;
                editMutation.mutate({ id: selected.id, payload: editDraft });
              }}
            >
              ذخیره
            </button>
          </>
        }
      >
        <div className="mb-2 rounded-lg bg-slate-50 border border-slate-200 p-2 text-xs text-slate-700">
          <span className="ml-3">ثبت‌کننده: {selected?.created_by_username || selected?.created_by_user_id || "-"}</span>
          <span>تکمیل‌کننده: {selected?.done_by_username || selected?.done_by_user_id || "-"}</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="text-sm text-slate-600">تاریخ</label>
            <input className="input mt-1" type="date" value={editDraft.date || ""} onChange={(e) => setEditDraft((p) => ({ ...p, date: e.target.value }))} />
          </div>
          <div>
            <label className="text-sm text-slate-600">نوع فعالیت</label>
            <input className="input mt-1" value={editDraft.activity_type || ""} onChange={(e) => setEditDraft((p) => ({ ...p, activity_type: e.target.value }))} />
          </div>
          <div>
            <label className="text-sm text-slate-600">نام مشتری</label>
            <input className="input mt-1" value={editDraft.customer_name || ""} onChange={(e) => setEditDraft((p) => ({ ...p, customer_name: e.target.value }))} />
          </div>
          <div>
            <label className="text-sm text-slate-600">موقعیت</label>
            <input className="input mt-1" value={editDraft.location || ""} onChange={(e) => setEditDraft((p) => ({ ...p, location: e.target.value }))} />
          </div>
          <div>
            <label className="text-sm text-slate-600">اولویت</label>
            <input
              className="input mt-1"
              type="number"
              min={0}
              max={1000}
              value={String(editDraft.priority ?? 0)}
              onChange={(e) => setEditDraft((p) => ({ ...p, priority: Number(e.target.value || 0) }))}
            />
          </div>
          {isAdmin && (
            <div>
              <label className="text-sm text-slate-600">وضعیت</label>
              <select
                className="input mt-1"
                value={editDraft.status || "pending"}
                onChange={(e) => setEditDraft((p) => ({ ...p, status: e.target.value as "pending" | "done" }))}
              >
                <option value="pending">در انتظار</option>
                <option value="done">انجام شد</option>
              </select>
            </div>
          )}
          <div className="md:col-span-2">
            <label className="text-sm text-slate-600">گزارش</label>
            <textarea className="input mt-1 min-h-24" value={editDraft.report_text || ""} onChange={(e) => setEditDraft((p) => ({ ...p, report_text: e.target.value }))} />
          </div>
          <div className="md:col-span-2">
            <label className="text-sm text-slate-600">کارمندان</label>
            <div className="mt-1 border border-slate-300 rounded-lg p-2 grid grid-cols-2 gap-2 max-h-44 overflow-auto">
              {(staffQuery.data || [])
                .filter((s) => s.active !== false)
                .map((s) => {
                  const selectedStaffIds = editDraft.assigned_staff_ids || [];
                  const checked = selectedStaffIds.includes(s.id);
                  return (
                    <label key={s.id} className="text-sm inline-flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => {
                          const next = new Set(editDraft.assigned_staff_ids || []);
                          if (e.target.checked) next.add(s.id);
                          else next.delete(s.id);
                          setEditDraft((p) => ({ ...p, assigned_staff_ids: [...next] }));
                        }}
                      />
                      {s.name}
                    </label>
                  );
                })}
            </div>
          </div>
        </div>
      </Modal>

      <Modal
        open={importOpen}
        title="واردسازی Excel"
        onClose={() => {
          setImportOpen(false);
          setImportFile(null);
          setValidateResult(null);
        }}
        footer={
          <>
            <button className="btn-secondary" onClick={() => setImportOpen(false)}>
              بستن
            </button>
            <button
              className="btn-secondary"
              disabled={!importFile || validateImportMutation.isPending}
              onClick={() => {
                if (importFile) validateImportMutation.mutate(importFile);
              }}
            >
              اعتبارسنجی
            </button>
            <button
              className="btn-primary"
              disabled={!importFile || importMutation.isPending}
              onClick={() => {
                if (importFile) importMutation.mutate({ file: importFile, mode: importMode });
              }}
            >
              واردسازی
            </button>
          </>
        }
      >
        <div className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <div>
              <label className="text-sm text-slate-700">حالت واردسازی</label>
              <select className="input mt-1" value={importMode} onChange={(e) => setImportMode(e.target.value as "insert" | "upsert")}>
                <option value="upsert">Upsert (ایجاد/به‌روزرسانی)</option>
                <option value="insert">Insert (فقط ایجاد)</option>
              </select>
            </div>
            <div>
              <label className="text-sm text-slate-700">فایل Excel</label>
              <input
                className="input mt-1"
                type="file"
                accept=".xlsx"
                onChange={(e) => {
                  setImportFile(e.target.files?.[0] || null);
                  setValidateResult(null);
                }}
              />
            </div>
          </div>

          {validateResult && (
            <div className="space-y-2">
              <div className="text-sm">
                <span className="ml-3">کل سطرها: {validateResult.total_rows}</span>
                <span className="ml-3 text-emerald-700">معتبر: {validateResult.valid_rows}</span>
                <span className="text-red-700">خطا: {validateResult.error_rows}</span>
              </div>
              {validateResult.errors.length > 0 && (
                <div className="max-h-32 overflow-auto rounded-lg border border-red-200 bg-red-50 p-2 text-xs text-red-700">
                  {validateResult.errors.map((err) => (
                    <p key={err.row}>سطر {err.row}: {err.errors.join(" | ")}</p>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </Modal>
    </section>
  );
}
