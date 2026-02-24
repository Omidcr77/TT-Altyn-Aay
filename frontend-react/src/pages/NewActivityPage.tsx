import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useFieldArray, useForm } from "react-hook-form";
import { z } from "zod";
import { useToast } from "@/components/ToastProvider";
import { createActivity } from "@/services/activities";
import { fetchMasterData } from "@/services/masterData";
import { fetchStaff } from "@/services/staff";
import { fetchSuggestions } from "@/services/suggestions";
import type { ActivityCreatePayload } from "@/types/activity";

const formSchema = z.object({
  date: z.string().min(1, "تاریخ ضروری است"),
  activity_type: z.string().trim().min(2, "نوع فعالیت ضروری است"),
  customer_name: z.string().trim().min(2, "نام مشتری ضروری است"),
  location: z.string().trim().max(120, "موقعیت باید کوتاه باشد").optional().or(z.literal("")),
  address: z.string().trim().max(255, "آدرس باید کوتاه باشد").optional().or(z.literal("")),
  device_info: z.string().trim().max(255, "اطلاعات دستگاه باید کوتاه باشد").optional().or(z.literal("")),
  report_text: z.string().trim().optional().or(z.literal("")),
  priority: z.coerce.number().int().min(0, "حداقل ۰").max(1000, "حداکثر ۱۰۰۰"),
  assigned_staff_ids: z.array(z.number()).default([]),
  extra_entries: z.array(
    z.object({
      key: z.string().trim().optional(),
      value: z.string().trim().optional()
    })
  )
});

type NewActivityFormValues = z.infer<typeof formSchema>;

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function useDebouncedValue(value: string, delayMs: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(id);
  }, [value, delayMs]);
  return debounced;
}

function toExtraFields(entries: Array<{ key?: string; value?: string }>) {
  const out: Record<string, string> = {};
  entries.forEach((entry) => {
    const key = (entry.key || "").trim();
    const value = (entry.value || "").trim();
    if (key && value) out[key] = value;
  });
  return out;
}

export function NewActivityPage() {
  const navigate = useNavigate();
  const { showToast } = useToast();

  const form = useForm<NewActivityFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      date: todayIso(),
      activity_type: "",
      customer_name: "",
      location: "",
      address: "",
      device_info: "",
      report_text: "",
      priority: 0,
      assigned_staff_ids: [],
      extra_entries: []
    }
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "extra_entries"
  });

  const customerValue = form.watch("customer_name") || "";
  const addressValue = form.watch("address") || "";
  const debouncedCustomer = useDebouncedValue(customerValue, 300);
  const debouncedAddress = useDebouncedValue(addressValue, 300);

  const masterQuery = useQuery({
    queryKey: ["master-data"],
    queryFn: fetchMasterData
  });

  const staffQuery = useQuery({
    queryKey: ["staff-options"],
    queryFn: fetchStaff
  });

  const customerSuggestionsQuery = useQuery({
    queryKey: ["suggestions", "customer_name", debouncedCustomer],
    queryFn: () => fetchSuggestions("customer_name", debouncedCustomer),
    enabled: debouncedCustomer.trim().length >= 2
  });

  const addressSuggestionsQuery = useQuery({
    queryKey: ["suggestions", "address", debouncedAddress],
    queryFn: () => fetchSuggestions("address", debouncedAddress),
    enabled: debouncedAddress.trim().length >= 2
  });

  const createMutation = useMutation({
    mutationFn: (payload: ActivityCreatePayload) => createActivity(payload),
    onSuccess: (created) => {
      showToast("فعالیت با موفقیت ثبت شد", "success");
      form.reset({
        date: todayIso(),
        activity_type: "",
        customer_name: "",
        location: "",
        address: "",
        device_info: "",
        report_text: "",
        priority: 0,
        assigned_staff_ids: [],
        extra_entries: []
      });
      navigate(`/activities?activityId=${created.id}`);
    },
    onError: (error) => {
      showToast(error instanceof Error ? error.message : "ثبت فعالیت ناکام شد", "error");
    }
  });

  const activityTypeOptions = useMemo(
    () =>
      (masterQuery.data || [])
        .filter((item) => item.category === "activity_type" && item.active)
        .map((item) => item.value),
    [masterQuery.data]
  );
  const locationOptions = useMemo(
    () =>
      (masterQuery.data || [])
        .filter((item) => item.category === "location" && item.active)
        .map((item) => item.value),
    [masterQuery.data]
  );
  const deviceOptions = useMemo(
    () =>
      (masterQuery.data || [])
        .filter((item) => item.category === "device_type" && item.active)
        .map((item) => item.value),
    [masterQuery.data]
  );

  const customerOptions = useMemo(() => {
    const list = customerSuggestionsQuery.data || [];
    return [...new Set(list)];
  }, [customerSuggestionsQuery.data]);
  const addressOptions = useMemo(() => {
    const list = addressSuggestionsQuery.data || [];
    return [...new Set(list)];
  }, [addressSuggestionsQuery.data]);

  const staffOptions = (staffQuery.data || []).filter((item) => item.active !== false);

  function onSubmit(values: NewActivityFormValues) {
    const payload: ActivityCreatePayload = {
      date: values.date,
      activity_type: values.activity_type.trim(),
      customer_name: values.customer_name.trim(),
      location: values.location?.trim() || null,
      address: values.address?.trim() || null,
      device_info: values.device_info?.trim() || null,
      report_text: values.report_text?.trim() || null,
      priority: values.priority,
      assigned_staff_ids: values.assigned_staff_ids,
      extra_fields: toExtraFields(values.extra_entries)
    };
    createMutation.mutate(payload);
  }

  const formErrors = form.formState.errors;

  return (
    <section className="space-y-3">
      <header className="card p-4">
        <h3 className="text-lg font-semibold">افزودن فعالیت</h3>
        <p className="text-sm text-slate-500 mt-1">معلومات مشتری، جزئیات فعالیت و تعیین کارمندان را ثبت کنید.</p>
      </header>

      <form className="space-y-3" onSubmit={form.handleSubmit(onSubmit)} noValidate>
        <section className="card p-4 space-y-3">
          <h4 className="font-semibold">معلومات مشتری</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="text-sm text-slate-700">نام مشتری</label>
              <input className="input mt-1" list="customer-suggestions" {...form.register("customer_name")} />
              <datalist id="customer-suggestions">
                {customerOptions.map((value) => (
                  <option key={value} value={value} />
                ))}
              </datalist>
              {formErrors.customer_name && <p className="text-xs text-red-600 mt-1">{formErrors.customer_name.message}</p>}
            </div>
            <div>
              <label className="text-sm text-slate-700">آدرس</label>
              <input className="input mt-1" list="address-suggestions" {...form.register("address")} />
              <datalist id="address-suggestions">
                {addressOptions.map((value) => (
                  <option key={value} value={value} />
                ))}
              </datalist>
              {formErrors.address && <p className="text-xs text-red-600 mt-1">{formErrors.address.message}</p>}
            </div>
            <div>
              <label className="text-sm text-slate-700">موقعیت</label>
              <input className="input mt-1" list="location-options" {...form.register("location")} />
              <datalist id="location-options">
                {locationOptions.map((value) => (
                  <option key={value} value={value} />
                ))}
              </datalist>
              {formErrors.location && <p className="text-xs text-red-600 mt-1">{formErrors.location.message}</p>}
            </div>
          </div>
        </section>

        <section className="card p-4 space-y-3">
          <h4 className="font-semibold">جزئیات فعالیت</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="text-sm text-slate-700">تاریخ</label>
              <input className="input mt-1" type="date" {...form.register("date")} />
              {formErrors.date && <p className="text-xs text-red-600 mt-1">{formErrors.date.message}</p>}
            </div>
            <div>
              <label className="text-sm text-slate-700">نوع فعالیت</label>
              <input className="input mt-1" list="activity-type-options" {...form.register("activity_type")} />
              <datalist id="activity-type-options">
                {activityTypeOptions.map((value) => (
                  <option key={value} value={value} />
                ))}
              </datalist>
              {formErrors.activity_type && <p className="text-xs text-red-600 mt-1">{formErrors.activity_type.message}</p>}
            </div>
            <div>
              <label className="text-sm text-slate-700">نوع/معلومات دستگاه</label>
              <input className="input mt-1" list="device-type-options" {...form.register("device_info")} />
              <datalist id="device-type-options">
                {deviceOptions.map((value) => (
                  <option key={value} value={value} />
                ))}
              </datalist>
              {formErrors.device_info && <p className="text-xs text-red-600 mt-1">{formErrors.device_info.message}</p>}
            </div>
            <div>
              <label className="text-sm text-slate-700">اولویت</label>
              <input className="input mt-1" type="number" min={0} max={1000} {...form.register("priority")} />
              {formErrors.priority && <p className="text-xs text-red-600 mt-1">{formErrors.priority.message}</p>}
            </div>
            <div className="md:col-span-2">
              <label className="text-sm text-slate-700">گزارش</label>
              <textarea className="input mt-1 min-h-24" {...form.register("report_text")} />
              {formErrors.report_text && <p className="text-xs text-red-600 mt-1">{formErrors.report_text.message}</p>}
            </div>
          </div>
        </section>

        <section className="card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold">سایر معلومات</h4>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => append({ key: "", value: "" })}
            >
              افزودن مورد
            </button>
          </div>
          {fields.length === 0 && <p className="text-sm text-slate-500">برای ثبت معلومات اضافی، مورد جدید اضافه کنید.</p>}
          {fields.map((field, index) => (
            <div key={field.id} className="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-2">
              <input className="input" placeholder="کلید" {...form.register(`extra_entries.${index}.key`)} />
              <input className="input" placeholder="مقدار" {...form.register(`extra_entries.${index}.value`)} />
              <button type="button" className="btn-secondary" onClick={() => remove(index)}>
                حذف
              </button>
            </div>
          ))}
        </section>

        <section className="card p-4 space-y-3">
          <h4 className="font-semibold">تعیین کارمندان</h4>
          {staffQuery.isLoading && <p className="text-sm text-slate-500">در حال بارگذاری کارمندان...</p>}
          {staffQuery.isError && <p className="text-sm text-red-600">دریافت کارمندان ناکام شد.</p>}
          {!staffQuery.isLoading && !staffQuery.isError && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {staffOptions.map((staff) => (
                <label key={staff.id} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 p-2 text-sm">
                  <input
                    type="checkbox"
                    value={staff.id}
                    checked={form.watch("assigned_staff_ids").includes(staff.id)}
                    onChange={(event) => {
                      const next = new Set(form.getValues("assigned_staff_ids"));
                      if (event.target.checked) next.add(staff.id);
                      else next.delete(staff.id);
                      form.setValue("assigned_staff_ids", [...next], { shouldValidate: true });
                    }}
                  />
                  <span>{staff.name}</span>
                </label>
              ))}
            </div>
          )}
        </section>

        <div className="card p-4 flex items-center gap-2">
          <button type="submit" className="btn-primary" disabled={createMutation.isPending}>
            {createMutation.isPending ? "در حال ذخیره..." : "ذخیره"}
          </button>
          <button
            type="button"
            className="btn-secondary"
            disabled={createMutation.isPending}
            onClick={() =>
              form.reset({
                date: todayIso(),
                activity_type: "",
                customer_name: "",
                location: "",
                address: "",
                device_info: "",
                report_text: "",
                priority: 0,
                assigned_staff_ids: [],
                extra_entries: []
              })
            }
          >
            پاک‌سازی
          </button>
        </div>
      </form>
    </section>
  );
}
