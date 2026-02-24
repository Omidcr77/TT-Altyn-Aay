import { useQuery } from "@tanstack/react-query";
import { fetchDashboardStats, fetchDashboardTrends } from "@/services/dashboard";

function barColor(i: number) {
  const palette = ["bg-brand-500", "bg-emerald-500", "bg-amber-500", "bg-sky-500", "bg-indigo-500"];
  return palette[i % palette.length];
}

function normalizeWidth(value: number, max: number) {
  if (max <= 0) return 8;
  return Math.max(8, Math.round((value / max) * 100));
}

function DashboardSkeleton() {
  return (
    <section className="space-y-3 animate-pulse">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, idx) => (
          <article key={idx} className="card p-4">
            <div className="h-4 w-20 bg-slate-200 rounded" />
            <div className="h-8 w-14 bg-slate-300 rounded mt-3" />
          </article>
        ))}
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
        {Array.from({ length: 2 }).map((_, idx) => (
          <section key={idx} className="card p-4 space-y-3">
            <div className="h-5 w-36 bg-slate-200 rounded" />
            {Array.from({ length: 5 }).map((_, rowIdx) => (
              <div key={rowIdx} className="grid grid-cols-[120px_1fr_30px] gap-2 items-center">
                <div className="h-4 bg-slate-200 rounded" />
                <div className="h-2 bg-slate-200 rounded" />
                <div className="h-4 bg-slate-200 rounded" />
              </div>
            ))}
          </section>
        ))}
      </div>
      <section className="card p-4 space-y-3">
        <div className="h-5 w-44 bg-slate-200 rounded" />
        {Array.from({ length: 6 }).map((_, idx) => (
          <div key={idx} className="h-8 bg-slate-100 rounded border border-slate-200" />
        ))}
      </section>
    </section>
  );
}

export function DashboardPage() {
  const statsQuery = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: fetchDashboardStats
  });
  const trendsQuery = useQuery({
    queryKey: ["dashboard-trends", 30],
    queryFn: () => fetchDashboardTrends(30)
  });

  if (statsQuery.isLoading || trendsQuery.isLoading) return <DashboardSkeleton />;
  if (statsQuery.isError) return <section className="card p-4 text-red-600">{statsQuery.error instanceof Error ? statsQuery.error.message : "خطا"}</section>;
  if (trendsQuery.isError) return <section className="card p-4 text-red-600">{trendsQuery.error instanceof Error ? trendsQuery.error.message : "خطا"}</section>;
  if (!statsQuery.data || !trendsQuery.data) return <section className="card p-4 text-slate-600">اطلاعات داشبورد در دسترس نیست.</section>;

  const stats = statsQuery.data;
  const trends = trendsQuery.data;
  const byType = stats.by_type.slice(0, 6);
  const byStaff = stats.by_staff.slice(0, 6);

  const maxTypeCount = Math.max(...byType.map((x) => x.count), 0);
  const maxStaffCount = Math.max(...byStaff.map((x) => x.count), 0);

  return (
    <section className="space-y-3">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <article className="card p-4">
          <p className="text-sm text-slate-500">امروز</p>
          <p className="text-2xl font-bold mt-2">{stats.total_today}</p>
        </article>
        <article className="card p-4">
          <p className="text-sm text-slate-500">این هفته</p>
          <p className="text-2xl font-bold mt-2">{stats.total_week}</p>
        </article>
        <article className="card p-4">
          <p className="text-sm text-slate-500">در انتظار</p>
          <p className="text-2xl font-bold mt-2">{stats.pending}</p>
        </article>
        <article className="card p-4">
          <p className="text-sm text-slate-500">انجام شد</p>
          <p className="text-2xl font-bold mt-2">{stats.done}</p>
        </article>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
        <section className="card p-4">
          <h3 className="font-semibold mb-3">بر اساس نوع فعالیت</h3>
          {byType.length === 0 ? (
            <p className="text-sm text-slate-500">داده ای برای نمایش وجود ندارد.</p>
          ) : (
            <div className="space-y-2">
              {byType.map((item, idx) => (
                <div key={`${item.name}-${idx}`} className="grid grid-cols-[120px_1fr_30px] gap-2 items-center">
                  <span className="text-sm truncate">{item.name}</span>
                  <div className="h-2 rounded-full bg-slate-200 overflow-hidden">
                    <div className={`h-full ${barColor(idx)}`} style={{ width: `${normalizeWidth(item.count, maxTypeCount)}%` }} />
                  </div>
                  <span className="text-xs text-slate-600">{item.count}</span>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="card p-4">
          <h3 className="font-semibold mb-3">بر اساس کارمند</h3>
          {byStaff.length === 0 ? (
            <p className="text-sm text-slate-500">داده ای برای نمایش وجود ندارد.</p>
          ) : (
            <div className="space-y-2">
              {byStaff.map((item, idx) => (
                <div key={`${item.name}-${idx}`} className="grid grid-cols-[120px_1fr_30px] gap-2 items-center">
                  <span className="text-sm truncate">{item.name}</span>
                  <div className="h-2 rounded-full bg-slate-200 overflow-hidden">
                    <div className={`h-full ${barColor(idx + 1)}`} style={{ width: `${normalizeWidth(item.count, maxStaffCount)}%` }} />
                  </div>
                  <span className="text-xs text-slate-600">{item.count}</span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <section className="card p-4">
        <h3 className="font-semibold mb-2">روند 30 روز اخیر</h3>
        {trends.items.length === 0 ? (
          <p className="text-sm text-slate-500">داده ای برای روند ثبت نشده است.</p>
        ) : (
          <div className="overflow-auto">
            <table className="w-full text-sm min-w-[520px]">
              <thead className="bg-slate-100">
                <tr>
                  <th className="text-right p-2">تاریخ</th>
                  <th className="text-right p-2">ایجاد</th>
                  <th className="text-right p-2">انجام</th>
                  <th className="text-right p-2">خالص</th>
                </tr>
              </thead>
              <tbody>
                {trends.items.slice(-10).map((row) => (
                  <tr key={row.date} className="border-t border-slate-200">
                    <td className="p-2">{row.date}</td>
                    <td className="p-2">{row.created}</td>
                    <td className="p-2">{row.done}</td>
                    <td className={`p-2 ${row.pending_delta >= 0 ? "text-amber-700" : "text-emerald-700"}`}>{row.pending_delta}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </section>
  );
}
