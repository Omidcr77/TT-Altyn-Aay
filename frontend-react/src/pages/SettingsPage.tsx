import { useEffect, useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useAuth } from "@/app/AuthContext";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { DataTable } from "@/components/DataTable";
import { Modal } from "@/components/Modal";
import { useToast } from "@/components/ToastProvider";
import { changePasswordRequest } from "@/services/http";
import {
  createMasterData,
  deleteMasterData,
  fetchMasterData,
  fetchSystemSettings,
  updateMasterData,
  upsertSystemSetting,
  type MasterDataPayload
} from "@/services/masterData";
import { fetchNotificationRules, runNotificationRules, saveNotificationRules, type NotificationRules } from "@/services/notifications";
import { fetchRolePermissions, saveRolePermissions } from "@/services/permissions";
import { createBackup, fetchBackups, restoreBackup } from "@/services/system";
import type { MasterCategory, MasterDataItem } from "@/types/masterData";
import type { RolePermissionsResponse } from "@/types/permissions";
import type { BackupItem } from "@/types/system";

const masterSchema = z.object({
  category: z.enum(["activity_type", "device_type", "location"]),
  value: z.string().trim().min(1, "مقدار ضروری است").max(120, "مقدار باید کوتاه باشد"),
  active: z.boolean()
});

type MasterForm = z.infer<typeof masterSchema>;

function categoryLabel(category: string) {
  if (category === "activity_type") return "نوع فعالیت";
  if (category === "device_type") return "نوع دستگاه";
  if (category === "location") return "موقعیت";
  return category;
}

function normalizeCategory(category: string): MasterCategory {
  if (category === "device_type") return "device_type";
  if (category === "location") return "location";
  return "activity_type";
}

export function SettingsPage() {
  const { role } = useAuth();
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const canAdminEdit = role === "admin";

  const [modalOpen, setModalOpen] = useState(false);
  const [editingMaster, setEditingMaster] = useState<MasterDataItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<MasterDataItem | null>(null);
  const [restoreTarget, setRestoreTarget] = useState<BackupItem | null>(null);

  const [emailEnabled, setEmailEnabled] = useState(false);
  const [emailRecipients, setEmailRecipients] = useState("");

  const [ruleValues, setRuleValues] = useState<NotificationRules>({
    overdue_enabled: true,
    unassigned_enabled: true,
    high_priority_enabled: true,
    high_priority_threshold: 5,
    overdue_days: 2
  });

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [rolePermissions, setRolePermissions] = useState<Record<string, string[]>>({});

  const masterForm = useForm<MasterForm>({
    resolver: zodResolver(masterSchema),
    defaultValues: { category: "activity_type", value: "", active: true }
  });

  const masterQuery = useQuery({
    queryKey: ["master-data"],
    queryFn: fetchMasterData
  });

  const systemSettingsQuery = useQuery({
    queryKey: ["system-settings"],
    queryFn: fetchSystemSettings,
    enabled: canAdminEdit
  });

  const rulesQuery = useQuery({
    queryKey: ["notification-rules"],
    queryFn: fetchNotificationRules
  });

  const backupsQuery = useQuery({
    queryKey: ["backups"],
    queryFn: fetchBackups,
    enabled: canAdminEdit
  });

  const permissionsQuery = useQuery({
    queryKey: ["role-permissions"],
    queryFn: fetchRolePermissions,
    enabled: canAdminEdit
  });

  useEffect(() => {
    if (!systemSettingsQuery.data) return;
    const map = new Map(systemSettingsQuery.data.map((row) => [row.key, row.value]));
    setEmailEnabled((map.get("email_enabled") || "false").toLowerCase() === "true");
    setEmailRecipients(map.get("email_recipients") || "");
  }, [systemSettingsQuery.data]);

  useEffect(() => {
    if (!rulesQuery.data) return;
    setRuleValues(rulesQuery.data);
  }, [rulesQuery.data]);

  useEffect(() => {
    if (!permissionsQuery.data) return;
    setRolePermissions(permissionsQuery.data.permissions || {});
  }, [permissionsQuery.data]);

  const createMasterMutation = useMutation({
    mutationFn: (payload: MasterDataPayload) => createMasterData(payload),
    onSuccess: () => {
      showToast("مقدار جدید ذخیره شد", "success");
      masterForm.reset({ category: "activity_type", value: "", active: true });
      setModalOpen(false);
      void queryClient.invalidateQueries({ queryKey: ["master-data"] });
    },
    onError: (error) => showToast(error instanceof Error ? error.message : "ثبت مقدار ناکام شد", "error")
  });

  const updateMasterMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: MasterDataPayload }) => updateMasterData(id, payload),
    onSuccess: () => {
      showToast("مقدار ویرایش شد", "success");
      masterForm.reset({ category: "activity_type", value: "", active: true });
      setEditingMaster(null);
      setModalOpen(false);
      void queryClient.invalidateQueries({ queryKey: ["master-data"] });
    },
    onError: (error) => showToast(error instanceof Error ? error.message : "ویرایش ناکام شد", "error")
  });

  const deleteMasterMutation = useMutation({
    mutationFn: (id: number) => deleteMasterData(id),
    onSuccess: () => {
      showToast("مقدار حذف شد", "success");
      setDeleteTarget(null);
      void queryClient.invalidateQueries({ queryKey: ["master-data"] });
    },
    onError: (error) => showToast(error instanceof Error ? error.message : "حذف ناکام شد", "error")
  });

  const saveEmailMutation = useMutation({
    mutationFn: async ({ enabled, recipients }: { enabled: boolean; recipients: string }) => {
      await upsertSystemSetting("email_enabled", enabled ? "true" : "false");
      await upsertSystemSetting("email_recipients", recipients.trim());
    },
    onSuccess: () => {
      showToast("تنظیمات ایمیل ذخیره شد", "success");
      void queryClient.invalidateQueries({ queryKey: ["system-settings"] });
    },
    onError: (error) => showToast(error instanceof Error ? error.message : "ذخیره تنظیمات ایمیل ناکام شد", "error")
  });

  const saveRulesMutation = useMutation({
    mutationFn: (payload: NotificationRules) => saveNotificationRules(payload),
    onSuccess: () => {
      showToast("قوانین اعلان ذخیره شد", "success");
      void queryClient.invalidateQueries({ queryKey: ["notification-rules"] });
    },
    onError: (error) => showToast(error instanceof Error ? error.message : "ذخیره قوانین ناکام شد", "error")
  });

  const runRulesMutation = useMutation({
    mutationFn: runNotificationRules,
    onSuccess: () => showToast("قوانین اعلان اجرا شد", "success"),
    onError: (error) => showToast(error instanceof Error ? error.message : "اجرای قوانین ناکام شد", "error")
  });

  const changePasswordMutation = useMutation({
    mutationFn: ({ current, next }: { current: string; next: string }) => changePasswordRequest(current, next),
    onSuccess: () => {
      showToast("رمز عبور با موفقیت تغییر کرد", "success");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    },
    onError: (error) => showToast(error instanceof Error ? error.message : "تغییر رمز ناکام شد", "error")
  });

  const createBackupMutation = useMutation({
    mutationFn: createBackup,
    onSuccess: (result) => {
      showToast(`Backup ایجاد شد: ${result.created}`, "success");
      void queryClient.invalidateQueries({ queryKey: ["backups"] });
    },
    onError: (error) => showToast(error instanceof Error ? error.message : "ایجاد Backup ناکام شد", "error")
  });

  const restoreBackupMutation = useMutation({
    mutationFn: (file: string) => restoreBackup(file),
    onSuccess: (result) => {
      showToast(`Backup بازیابی شد: ${result.restored}`, "success");
      setRestoreTarget(null);
      void queryClient.invalidateQueries({ queryKey: ["backups"] });
    },
    onError: (error) => showToast(error instanceof Error ? error.message : "بازیابی Backup ناکام شد", "error")
  });

  const savePermissionsMutation = useMutation({
    mutationFn: (mapping: Record<string, string[]>) => saveRolePermissions(mapping),
    onSuccess: () => {
      showToast("ماتریس دسترسی ذخیره شد", "success");
      void queryClient.invalidateQueries({ queryKey: ["role-permissions"] });
    },
    onError: (error) => showToast(error instanceof Error ? error.message : "ذخیره دسترسی‌ها ناکام شد", "error")
  });

  const masterColumns = useMemo<ColumnDef<MasterDataItem>[]>(
    () => [
      { accessorKey: "id", header: "ID" },
      {
        accessorKey: "category",
        header: "کتگوری",
        cell: ({ row }) => categoryLabel(row.original.category)
      },
      { accessorKey: "value", header: "مقدار" },
      {
        accessorKey: "active",
        header: "وضعیت",
        cell: ({ row }) =>
          row.original.active ? (
            <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs text-emerald-700">فعال</span>
          ) : (
            <span className="rounded-full bg-slate-200 px-2 py-1 text-xs">غیرفعال</span>
          )
      },
      {
        id: "actions",
        header: "اقدام",
        cell: ({ row }) =>
          canAdminEdit ? (
            <div className="flex gap-1">
              <button
                className="btn-secondary"
                onClick={() => {
                  setEditingMaster(row.original);
                  masterForm.reset({
                    category: normalizeCategory(row.original.category),
                    value: row.original.value,
                    active: row.original.active
                  });
                  setModalOpen(true);
                }}
              >
                ویرایش
              </button>
              <button className="btn bg-red-600 text-white hover:bg-red-700" onClick={() => setDeleteTarget(row.original)}>
                حذف
              </button>
            </div>
          ) : (
            <span className="text-slate-400 text-xs">فقط مشاهده</span>
          )
      }
    ],
    [canAdminEdit, masterForm]
  );

  function openCreateMaster() {
    setEditingMaster(null);
    masterForm.reset({ category: "activity_type", value: "", active: true });
    setModalOpen(true);
  }

  function submitMaster(values: MasterForm) {
    const payload: MasterDataPayload = {
      category: values.category,
      value: values.value.trim(),
      active: values.active
    };
    if (editingMaster) {
      updateMasterMutation.mutate({ id: editingMaster.id, payload });
      return;
    }
    createMasterMutation.mutate(payload);
  }

  function toggleRolePermission(role: string, permission: string, checked: boolean) {
    setRolePermissions((prev) => {
      const current = new Set(prev[role] || []);
      if (checked) current.add(permission);
      else current.delete(permission);
      return { ...prev, [role]: Array.from(current).sort() };
    });
  }

  const permissionAvailable = (permissionsQuery.data as RolePermissionsResponse | undefined)?.available || [];

  return (
    <section className="space-y-3">
      <header className="card p-4">
        <h3 className="text-lg font-semibold">تنظیمات</h3>
        <p className="text-sm text-slate-500 mt-1">مدیریت داده های پایه، اعلان ایمیلی و قوانین اعلان سیستم.</p>
      </header>

      {!canAdminEdit && (
        <section className="card p-3 text-sm text-amber-700 bg-amber-50 border-amber-200">
          شما مدیر هستید و بخش داده های پایه/تنظیمات ایمیل فقط قابل مشاهده است. برای تغییرات، ادمین نیاز است.
        </section>
      )}

      <section className="card p-3 space-y-3">
        <h4 className="font-semibold">امنیت حساب</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="text-sm text-slate-700">رمز فعلی</label>
            <input className="input mt-1" type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
          </div>
          <div>
            <label className="text-sm text-slate-700">رمز جدید</label>
            <input className="input mt-1" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
          </div>
          <div>
            <label className="text-sm text-slate-700">تکرار رمز جدید</label>
            <input className="input mt-1" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
          </div>
        </div>
        <div>
          <button
            className="btn-primary"
            disabled={changePasswordMutation.isPending}
            onClick={() => {
              if (newPassword.length < 6) {
                showToast("رمز جدید حداقل ۶ کاراکتر باشد", "error");
                return;
              }
              if (newPassword !== confirmPassword) {
                showToast("تکرار رمز جدید مطابقت ندارد", "error");
                return;
              }
              changePasswordMutation.mutate({ current: currentPassword, next: newPassword });
            }}
          >
            تغییر رمز عبور
          </button>
        </div>
      </section>

      {canAdminEdit && (
        <section className="card p-3 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold">ماتریس دسترسی نقش‌ها</h4>
            <button className="btn-primary" disabled={savePermissionsMutation.isPending} onClick={() => savePermissionsMutation.mutate(rolePermissions)}>
              ذخیره دسترسی‌ها
            </button>
          </div>
          {permissionsQuery.isLoading ? (
            <div className="text-sm text-slate-500">در حال بارگذاری دسترسی‌ها...</div>
          ) : permissionsQuery.isError ? (
            <div className="text-sm text-red-600">{permissionsQuery.error instanceof Error ? permissionsQuery.error.message : "خطا در دریافت دسترسی‌ها"}</div>
          ) : (
            <div className="overflow-auto border border-slate-200 rounded-lg">
              <table className="w-full text-sm min-w-[760px]">
                <thead className="bg-slate-100">
                  <tr>
                    <th className="text-right p-2">دسترسی</th>
                    <th className="text-right p-2">admin</th>
                    <th className="text-right p-2">manager</th>
                    <th className="text-right p-2">staff</th>
                    <th className="text-right p-2">viewer</th>
                  </tr>
                </thead>
                <tbody>
                  {permissionAvailable.map((perm) => (
                    <tr key={perm} className="border-t border-slate-200">
                      <td className="p-2 font-mono text-xs">{perm}</td>
                      {(["admin", "manager", "staff", "viewer"] as const).map((role) => (
                        <td key={role} className="p-2">
                          <input
                            type="checkbox"
                            checked={(rolePermissions[role] || []).includes(perm)}
                            onChange={(e) => toggleRolePermission(role, perm, e.target.checked)}
                            disabled={role === "admin" && perm === "users.manage"}
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      <section className="card p-3 space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="font-semibold">داده های پایه</h4>
          {canAdminEdit && (
            <button className="btn-primary" onClick={openCreateMaster}>
              افزودن مقدار
            </button>
          )}
        </div>
        {masterQuery.isLoading ? (
          <div className="text-sm text-slate-500">در حال بارگذاری داده ها...</div>
        ) : masterQuery.isError ? (
          <div className="text-sm text-red-600">{masterQuery.error instanceof Error ? masterQuery.error.message : "خطا در دریافت داده ها"}</div>
        ) : (
          <DataTable columns={masterColumns} data={masterQuery.data || []} />
        )}
      </section>

      {canAdminEdit && (
        <section className="card p-3 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold">Backup / Restore</h4>
            <button className="btn-primary" disabled={createBackupMutation.isPending} onClick={() => createBackupMutation.mutate()}>
              ایجاد Backup
            </button>
          </div>
          {backupsQuery.isLoading ? (
            <div className="text-sm text-slate-500">در حال بارگذاری Backup ها...</div>
          ) : backupsQuery.isError ? (
            <div className="text-sm text-red-600">{backupsQuery.error instanceof Error ? backupsQuery.error.message : "خطا در دریافت Backup ها"}</div>
          ) : (
            <div className="overflow-auto border border-slate-200 rounded-lg">
              <table className="w-full text-sm">
                <thead className="bg-slate-100">
                  <tr>
                    <th className="text-right p-2">ID</th>
                    <th className="text-right p-2">فایل</th>
                    <th className="text-right p-2">تاریخ</th>
                    <th className="text-right p-2">اندازه</th>
                    <th className="text-right p-2">اقدام</th>
                  </tr>
                </thead>
                <tbody>
                  {(backupsQuery.data || []).map((item, index) => (
                    <tr key={item.file} className="border-t border-slate-200">
                      <td className="p-2">{index + 1}</td>
                      <td className="p-2">{item.file}</td>
                      <td className="p-2">{item.created_at}</td>
                      <td className="p-2">{item.size_bytes}</td>
                      <td className="p-2">
                        <button className="btn bg-red-600 text-white hover:bg-red-700" onClick={() => setRestoreTarget(item)}>
                          Restore
                        </button>
                      </td>
                    </tr>
                  ))}
                  {!(backupsQuery.data || []).length && (
                    <tr>
                      <td className="p-4 text-slate-500" colSpan={5}>
                        Backup موجود نیست.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      <section className="card p-3 space-y-3">
        <h4 className="font-semibold">اعلان ایمیلی</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <label className="inline-flex items-center gap-2 text-sm">
            <input type="checkbox" checked={emailEnabled} onChange={(e) => setEmailEnabled(e.target.checked)} disabled={!canAdminEdit} />
            فعال بودن ایمیل
          </label>
          <div>
            <label className="text-sm text-slate-700">گیرنده ها (با کاما جدا کنید)</label>
            <input
              className="input mt-1"
              value={emailRecipients}
              onChange={(e) => setEmailRecipients(e.target.value)}
              placeholder="a@example.com, b@example.com"
              disabled={!canAdminEdit}
            />
          </div>
        </div>
        {canAdminEdit && (
          <div>
            <button
              className="btn-primary"
              disabled={saveEmailMutation.isPending}
              onClick={() => saveEmailMutation.mutate({ enabled: emailEnabled, recipients: emailRecipients })}
            >
              ذخیره تنظیمات ایمیل
            </button>
          </div>
        )}
      </section>

      <section className="card p-3 space-y-3">
        <h4 className="font-semibold">قوانین اعلان</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <label className="inline-flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={ruleValues.overdue_enabled}
              onChange={(e) => setRuleValues((prev) => ({ ...prev, overdue_enabled: e.target.checked }))}
            />
            اعلان تاخیر فعالیت ها
          </label>
          <label className="inline-flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={ruleValues.unassigned_enabled}
              onChange={(e) => setRuleValues((prev) => ({ ...prev, unassigned_enabled: e.target.checked }))}
            />
            اعلان فعالیت های بدون کارمند
          </label>
          <label className="inline-flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={ruleValues.high_priority_enabled}
              onChange={(e) => setRuleValues((prev) => ({ ...prev, high_priority_enabled: e.target.checked }))}
            />
            اعلان اولویت بالا
          </label>
          <div>
            <label className="text-sm text-slate-700">آستانه اولویت بالا</label>
            <input
              className="input mt-1"
              type="number"
              min={0}
              max={1000}
              value={ruleValues.high_priority_threshold}
              onChange={(e) =>
                setRuleValues((prev) => ({ ...prev, high_priority_threshold: Number(e.target.value || 0) }))
              }
            />
          </div>
          <div>
            <label className="text-sm text-slate-700">روزهای تاخیر</label>
            <input
              className="input mt-1"
              type="number"
              min={0}
              max={365}
              value={ruleValues.overdue_days}
              onChange={(e) => setRuleValues((prev) => ({ ...prev, overdue_days: Number(e.target.value || 0) }))}
            />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="btn-primary" disabled={saveRulesMutation.isPending} onClick={() => saveRulesMutation.mutate(ruleValues)}>
            ذخیره قوانین
          </button>
          <button className="btn-secondary" disabled={runRulesMutation.isPending} onClick={() => runRulesMutation.mutate()}>
            اجرای فوری قوانین
          </button>
        </div>
      </section>

      <Modal
        open={modalOpen}
        title={editingMaster ? "ویرایش داده پایه" : "افزودن داده پایه"}
        onClose={() => setModalOpen(false)}
        footer={
          <>
            <button className="btn-secondary" onClick={() => setModalOpen(false)}>
              انصراف
            </button>
            <button
              className="btn-primary"
              disabled={createMasterMutation.isPending || updateMasterMutation.isPending}
              onClick={masterForm.handleSubmit(submitMaster)}
            >
              ذخیره
            </button>
          </>
        }
      >
        <div className="space-y-3">
          <div>
            <label className="text-sm text-slate-700">کتگوری</label>
            <select className="input mt-1" {...masterForm.register("category")}>
              <option value="activity_type">نوع فعالیت</option>
              <option value="device_type">نوع دستگاه</option>
              <option value="location">موقعیت</option>
            </select>
          </div>
          <div>
            <label className="text-sm text-slate-700">مقدار</label>
            <input className="input mt-1" {...masterForm.register("value")} />
            {masterForm.formState.errors.value && <p className="text-xs text-red-600 mt-1">{masterForm.formState.errors.value.message}</p>}
          </div>
          <label className="inline-flex items-center gap-2 text-sm">
            <input type="checkbox" {...masterForm.register("active")} />
            فعال
          </label>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        title="حذف داده پایه"
        message={deleteTarget ? `مقدار "${deleteTarget.value}" حذف شود؟` : ""}
        danger
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) deleteMasterMutation.mutate(deleteTarget.id);
        }}
      />

      <ConfirmDialog
        open={!!restoreTarget}
        title="بازیابی Backup"
        message={restoreTarget ? `فایل "${restoreTarget.file}" بازیابی شود؟` : ""}
        danger
        onCancel={() => setRestoreTarget(null)}
        onConfirm={() => {
          if (restoreTarget) restoreBackupMutation.mutate(restoreTarget.file);
        }}
      />
    </section>
  );
}
