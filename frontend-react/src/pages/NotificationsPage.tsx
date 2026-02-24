import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useNotificationsChannel } from "@/app/NotificationsContext";
import { useToast } from "@/components/ToastProvider";
import { fetchNotifications, markNotificationRead } from "@/services/notifications";

function formatDate(value: string) {
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

export function NotificationsPage() {
  const { connected, unread } = useNotificationsChannel();
  const { showToast } = useToast();
  const queryClient = useQueryClient();

  const notifQuery = useQuery({
    queryKey: ["notifications"],
    queryFn: () => fetchNotifications(false)
  });

  const readMutation = useMutation({
    mutationFn: (id: number) => markNotificationRead(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
    onError: (error) => {
      showToast(error instanceof Error ? error.message : "علامت‌گذاری اعلان ناکام شد", "error");
    }
  });

  const items = notifQuery.data?.items ?? [];
  const hasUnread = useMemo(() => items.some((item) => !item.read_at), [items]);

  return (
    <section className="card p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold">اعلان ها</h3>
          <p className="text-sm text-slate-500">خوانده نشده: {unread}</p>
        </div>
        <div className="text-xs text-slate-500">
          <span className="ml-1">وضعیت اتصال:</span>
          <span className={connected ? "text-emerald-700" : "text-amber-700"}>
            {connected ? "WebSocket" : "Polling"}
          </span>
        </div>
      </div>

      {notifQuery.isLoading && (
        <div className="space-y-2 animate-pulse">
          {Array.from({ length: 5 }).map((_, idx) => (
            <div key={idx} className="rounded-lg border border-slate-200 bg-slate-100 h-20" />
          ))}
        </div>
      )}
      {notifQuery.isError && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-red-700 text-sm">
          {notifQuery.error instanceof Error ? notifQuery.error.message : "خطا در دریافت اعلان ها"}
        </div>
      )}

      {!notifQuery.isLoading && !notifQuery.isError && items.length === 0 && (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">اعلانی موجود نیست.</div>
      )}

      {!notifQuery.isLoading && !notifQuery.isError && items.length > 0 && (
        <ul className="space-y-2">
          {items.map((item) => {
            const isPending = readMutation.isPending && readMutation.variables === item.id;
            return (
              <li
                key={item.id}
                className={`rounded-lg border p-3 ${item.read_at ? "border-slate-200 bg-white" : "border-brand-200 bg-brand-50/40"}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="font-medium leading-6">{item.text}</p>
                  {!item.read_at && <span className="rounded-full bg-red-500 px-2 py-0.5 text-xs text-white">نو</span>}
                </div>
                <p className="mt-1 text-xs text-slate-500">{formatDate(item.created_at)}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {!item.read_at && (
                    <button
                      className="btn-secondary"
                      disabled={isPending}
                      onClick={() => readMutation.mutate(item.id)}
                    >
                      {isPending ? "در حال ثبت..." : "علامت خوانده شد"}
                    </button>
                  )}
                  {item.activity_id && (
                    <Link className="btn-primary" to={`/activities?activityId=${item.activity_id}`}>
                      مشاهده فعالیت
                    </Link>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {!hasUnread && !notifQuery.isLoading && !notifQuery.isError && (
        <div className="text-xs text-slate-500">همه اعلان ها خوانده شده اند.</div>
      )}
    </section>
  );
}
