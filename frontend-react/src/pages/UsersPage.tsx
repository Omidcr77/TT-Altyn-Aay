import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/DataTable";
import { Modal } from "@/components/Modal";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useToast } from "@/components/ToastProvider";
import { createUser, deleteUser, fetchUsers, updateUser } from "@/services/users";
import type { AppRole, AppUser } from "@/types/user";

const ROLES: AppRole[] = ["admin", "manager", "staff", "viewer"];

export function UsersPage() {
  const { showToast } = useToast();
  const queryClient = useQueryClient();

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<AppUser | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AppUser | null>(null);

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<AppRole>("staff");

  const usersQuery = useQuery({ queryKey: ["users"], queryFn: fetchUsers });

  const createMutation = useMutation({
    mutationFn: createUser,
    onSuccess: () => {
      showToast("کاربر ساخته شد", "success");
      closeModal();
      void queryClient.invalidateQueries({ queryKey: ["users"] });
    },
    onError: (e) => showToast(e instanceof Error ? e.message : "ثبت کاربر ناکام شد", "error")
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: { username?: string; password?: string; role?: AppRole } }) => updateUser(id, payload),
    onSuccess: () => {
      showToast("کاربر ویرایش شد", "success");
      closeModal();
      void queryClient.invalidateQueries({ queryKey: ["users"] });
    },
    onError: (e) => showToast(e instanceof Error ? e.message : "ویرایش کاربر ناکام شد", "error")
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteUser(id),
    onSuccess: () => {
      showToast("کاربر حذف شد", "success");
      setDeleteTarget(null);
      void queryClient.invalidateQueries({ queryKey: ["users"] });
    },
    onError: (e) => showToast(e instanceof Error ? e.message : "حذف کاربر ناکام شد", "error")
  });

  const columns = useMemo<ColumnDef<AppUser>[]>(
    () => [
      { accessorKey: "username", header: "نام کاربری" },
      { accessorKey: "role", header: "نقش" },
      { accessorKey: "created_at", header: "تاریخ ایجاد" },
      {
        id: "actions",
        header: "اقدام",
        cell: ({ row }) => (
          <div className="flex gap-1">
            <button className="btn-secondary" onClick={() => openEdit(row.original)}>
              ویرایش
            </button>
            <button className="btn bg-red-600 text-white hover:bg-red-700" onClick={() => setDeleteTarget(row.original)}>
              حذف
            </button>
          </div>
        )
      }
    ],
    []
  );

  function openCreate() {
    setEditing(null);
    setUsername("");
    setPassword("");
    setRole("staff");
    setModalOpen(true);
  }

  function openEdit(user: AppUser) {
    setEditing(user);
    setUsername(user.username);
    setPassword("");
    setRole(user.role);
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditing(null);
    setUsername("");
    setPassword("");
    setRole("staff");
  }

  function submit() {
    if (!username.trim()) {
      showToast("نام کاربری ضروری است", "error");
      return;
    }

    if (editing) {
      const payload: { username?: string; password?: string; role?: AppRole } = { username: username.trim(), role };
      if (password.trim()) payload.password = password;
      updateMutation.mutate({ id: editing.id, payload });
      return;
    }

    if (password.trim().length < 6) {
      showToast("رمز عبور حداقل 6 حرف باشد", "error");
      return;
    }

    createMutation.mutate({ username: username.trim(), password: password.trim(), role });
  }

  return (
    <section className="space-y-3">
      <header className="card p-4 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">مدیریت کاربران</h3>
          <p className="text-sm text-slate-500">ادمین میتواند کاربران را اضافه، ویرایش یا حذف کند.</p>
        </div>
        <button className="btn-primary" onClick={openCreate}>
          افزودن کاربر
        </button>
      </header>

      <section className="card p-3">
        {usersQuery.isLoading ? (
          <div className="text-sm text-slate-500">در حال بارگذاری...</div>
        ) : usersQuery.isError ? (
          <div className="text-sm text-red-600">{usersQuery.error instanceof Error ? usersQuery.error.message : "خطا"}</div>
        ) : (
          <DataTable columns={columns} data={usersQuery.data || []} />
        )}
      </section>

      <Modal
        open={modalOpen}
        title={editing ? "ویرایش کاربر" : "افزودن کاربر"}
        onClose={closeModal}
        footer={
          <>
            <button className="btn-secondary" onClick={closeModal}>
              انصراف
            </button>
            <button className="btn-primary" onClick={submit} disabled={createMutation.isPending || updateMutation.isPending}>
              ذخیره
            </button>
          </>
        }
      >
        <div className="space-y-3">
          <div>
            <label className="text-sm text-slate-700">نام کاربری</label>
            <input className="input mt-1" value={username} onChange={(e) => setUsername(e.target.value)} />
          </div>
          <div>
            <label className="text-sm text-slate-700">نقش</label>
            <select className="input mt-1" value={role} onChange={(e) => setRole(e.target.value as AppRole)}>
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm text-slate-700">رمز عبور {editing ? "(اختیاری برای تغییر)" : ""}</label>
            <input className="input mt-1" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        title="حذف کاربر"
        message={deleteTarget ? `کاربر "${deleteTarget.username}" حذف شود؟` : ""}
        danger
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) deleteMutation.mutate(deleteTarget.id);
        }}
      />
    </section>
  );
}
