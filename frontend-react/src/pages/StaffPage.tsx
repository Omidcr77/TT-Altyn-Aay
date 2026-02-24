import { useMemo, useState } from "react";
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
import { createStaff, deleteStaff, fetchStaff, updateStaff, type StaffPayload } from "@/services/staff";
import type { StaffRef } from "@/types/activity";

const staffSchema = z.object({
  name: z.string().trim().min(2, "نام کارمند ضروری است").max(120, "نام باید کوتاه باشد"),
  phone: z.string().trim().max(50, "شماره تماس باید کوتاه باشد").optional().or(z.literal("")),
  active: z.boolean()
});

type StaffForm = z.infer<typeof staffSchema>;

export function StaffPage() {
  const { role } = useAuth();
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const canEdit = role === "admin";

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<StaffRef | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<StaffRef | null>(null);

  const staffQuery = useQuery({
    queryKey: ["staff-options"],
    queryFn: fetchStaff
  });

  const form = useForm<StaffForm>({
    resolver: zodResolver(staffSchema),
    defaultValues: { name: "", phone: "", active: true }
  });

  const createMutation = useMutation({
    mutationFn: (payload: StaffPayload) => createStaff(payload),
    onSuccess: () => {
      showToast("کارمند جدید ثبت شد", "success");
      setModalOpen(false);
      form.reset({ name: "", phone: "", active: true });
      void queryClient.invalidateQueries({ queryKey: ["staff-options"] });
    },
    onError: (error) => {
      showToast(error instanceof Error ? error.message : "ثبت کارمند ناکام شد", "error");
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: StaffPayload }) => updateStaff(id, payload),
    onSuccess: () => {
      showToast("اطلاعات کارمند به‌روزرسانی شد", "success");
      setModalOpen(false);
      setEditing(null);
      form.reset({ name: "", phone: "", active: true });
      void queryClient.invalidateQueries({ queryKey: ["staff-options"] });
    },
    onError: (error) => {
      showToast(error instanceof Error ? error.message : "ویرایش کارمند ناکام شد", "error");
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteStaff(id),
    onSuccess: () => {
      showToast("کارمند حذف شد", "success");
      setDeleteTarget(null);
      void queryClient.invalidateQueries({ queryKey: ["staff-options"] });
    },
    onError: (error) => {
      showToast(error instanceof Error ? error.message : "حذف کارمند ناکام شد", "error");
    }
  });

  function openCreate() {
    setEditing(null);
    form.reset({ name: "", phone: "", active: true });
    setModalOpen(true);
  }

  function openEdit(item: StaffRef) {
    setEditing(item);
    form.reset({ name: item.name, phone: item.phone || "", active: item.active !== false });
    setModalOpen(true);
  }

  function submitForm(values: StaffForm) {
    const payload: StaffPayload = {
      name: values.name.trim(),
      phone: values.phone?.trim() || null,
      active: values.active
    };
    if (editing) {
      updateMutation.mutate({ id: editing.id, payload });
    } else {
      createMutation.mutate(payload);
    }
  }

  const rows = staffQuery.data || [];
  const columns = useMemo<ColumnDef<StaffRef>[]>(
    () => [
      { accessorKey: "name", header: "نام" },
      { accessorKey: "phone", header: "شماره تماس", cell: ({ row }) => row.original.phone || "-" },
      {
        accessorKey: "active",
        header: "وضعیت",
        cell: ({ row }) =>
          row.original.active === false ? (
            <span className="rounded-full bg-slate-200 px-2 py-1 text-xs">غیرفعال</span>
          ) : (
            <span className="rounded-full bg-emerald-100 text-emerald-700 px-2 py-1 text-xs">فعال</span>
          )
      },
      {
        id: "actions",
        header: "اقدام",
        cell: ({ row }) =>
          canEdit ? (
            <div className="flex gap-1">
              <button className="btn-secondary" onClick={() => openEdit(row.original)}>
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
    [canEdit]
  );

  return (
    <section className="space-y-3">
      <header className="card p-4 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">کارمندان</h3>
          <p className="text-sm text-slate-500">مدیریت تیم تخنیکی و وضعیت فعال/غیرفعال.</p>
        </div>
        {canEdit && (
          <button className="btn-primary" onClick={openCreate}>
            افزودن کارمند
          </button>
        )}
      </header>

      {!canEdit && (
        <section className="card p-3 text-sm text-amber-700 bg-amber-50 border-amber-200">
          شما دسترسی ویرایش ندارید. فقط ادمین می‌تواند کارمند اضافه، ویرایش یا حذف کند.
        </section>
      )}

      <section className="card p-3">
        {staffQuery.isLoading ? (
          <div className="text-sm text-slate-500">در حال بارگذاری کارمندان...</div>
        ) : staffQuery.isError ? (
          <div className="text-sm text-red-600">{staffQuery.error instanceof Error ? staffQuery.error.message : "خطا در دریافت کارمندان"}</div>
        ) : (
          <DataTable columns={columns} data={rows} />
        )}
      </section>

      <Modal
        open={modalOpen}
        title={editing ? "ویرایش کارمند" : "افزودن کارمند"}
        onClose={() => setModalOpen(false)}
        footer={
          <>
            <button className="btn-secondary" onClick={() => setModalOpen(false)}>
              انصراف
            </button>
            <button
              className="btn-primary"
              onClick={form.handleSubmit(submitForm)}
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              ذخیره
            </button>
          </>
        }
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="text-sm text-slate-700">نام</label>
            <input className="input mt-1" {...form.register("name")} />
            {form.formState.errors.name && <p className="text-xs text-red-600 mt-1">{form.formState.errors.name.message}</p>}
          </div>
          <div>
            <label className="text-sm text-slate-700">شماره تماس</label>
            <input className="input mt-1" {...form.register("phone")} />
            {form.formState.errors.phone && <p className="text-xs text-red-600 mt-1">{form.formState.errors.phone.message}</p>}
          </div>
          <label className="inline-flex items-center gap-2 text-sm md:col-span-2">
            <input type="checkbox" {...form.register("active")} />
            فعال
          </label>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        title="حذف کارمند"
        message={deleteTarget ? `کارمند "${deleteTarget.name}" حذف شود؟` : ""}
        danger
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) deleteMutation.mutate(deleteTarget.id);
        }}
      />
    </section>
  );
}
