import { useMemo, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/app/AuthContext";
import { useNotificationsChannel } from "@/app/NotificationsContext";

const navBase = "block rounded-lg px-3 py-2 text-sm font-medium transition-colors";

function pageMeta(pathname: string) {
  if (pathname === "/") return { title: "داشبورد", subtitle: "نمای کلی عملیات امروز" };
  if (pathname.startsWith("/activities")) return { title: "فعالیت ها", subtitle: "مدیریت، فیلتر و پیگیری فعالیت ها" };
  if (pathname.startsWith("/new-activity")) return { title: "افزودن فعالیت", subtitle: "ثبت فعالیت جدید و تعیین کارمندان" };
  if (pathname.startsWith("/notifications")) return { title: "اعلان ها", subtitle: "پیام های جدید و وضعیت پیگیری" };
  if (pathname.startsWith("/staff")) return { title: "کارمندان", subtitle: "مدیریت وضعیت و اطلاعات کارمندان" };
  if (pathname.startsWith("/settings")) return { title: "تنظیمات", subtitle: "داده های پایه و تنظیمات سیستم" };
  if (pathname.startsWith("/audit")) return { title: "گزارش ممیزی", subtitle: "ردیابی عملیات و تغییرات سیستم" };
  if (pathname.startsWith("/users")) return { title: "مدیریت کاربران", subtitle: "CRUD کاربران و نقش ها" };
  return { title: "TT Altyn Aay", subtitle: "نسخه React" };
}

export function AppShell() {
  const { username, role, logout } = useAuth();
  const { unread, connected } = useNotificationsChannel();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const isAdmin = role === "admin";
  const isManager = role === "manager";
  const meta = useMemo(() => pageMeta(location.pathname), [location.pathname]);

  const closeMenu = () => setMenuOpen(false);

  return (
    <div className="min-h-screen bg-slate-100 lg:grid lg:grid-cols-[260px_1fr]">
      <button
        className={`fixed inset-0 z-30 bg-slate-900/40 lg:hidden ${menuOpen ? "block" : "hidden"}`}
        onClick={closeMenu}
        aria-label="بستن منو"
      />
      <aside
        className={`fixed inset-y-0 right-0 z-40 w-[260px] bg-brand-900 text-white p-4 grid grid-rows-[auto_1fr_auto] gap-4 transition-transform lg:static lg:w-auto ${
          menuOpen ? "translate-x-0" : "translate-x-full lg:translate-x-0"
        }`}
      >
        <div>
          <h1 className="text-xl font-bold">TT Altyn Aay App</h1>
          <p className="text-brand-100 text-sm mt-1">نسخه React - Phase 6</p>
        </div>

        <nav className="space-y-2">
          <NavLink to="/" end onClick={closeMenu} className={({ isActive }) => `${navBase} ${isActive ? "bg-brand-500" : "hover:bg-brand-700"}`}>
            داشبورد
          </NavLink>
          <NavLink to="/activities" onClick={closeMenu} className={({ isActive }) => `${navBase} ${isActive ? "bg-brand-500" : "hover:bg-brand-700"}`}>
            فعالیت ها
          </NavLink>
          <NavLink to="/new-activity" onClick={closeMenu} className={({ isActive }) => `${navBase} ${isActive ? "bg-brand-500" : "hover:bg-brand-700"}`}>
            افزودن فعالیت
          </NavLink>
          <NavLink to="/notifications" onClick={closeMenu} className={({ isActive }) => `${navBase} ${isActive ? "bg-brand-500" : "hover:bg-brand-700"} flex items-center justify-between`}>
            <span>اعلان ها</span>
            <span className="inline-flex items-center gap-2">
              {unread > 0 && <span className="rounded-full bg-red-500 px-2 py-0.5 text-xs text-white">{unread}</span>}
              <span className={`h-2 w-2 rounded-full ${connected ? "bg-emerald-400" : "bg-amber-300"}`} title={connected ? "متصل" : "fallback"} />
            </span>
          </NavLink>
          {(isAdmin || isManager) && (
            <>
              <NavLink to="/staff" onClick={closeMenu} className={({ isActive }) => `${navBase} ${isActive ? "bg-brand-500" : "hover:bg-brand-700"}`}>
                کارمندان
              </NavLink>
              <NavLink to="/settings" onClick={closeMenu} className={({ isActive }) => `${navBase} ${isActive ? "bg-brand-500" : "hover:bg-brand-700"}`}>
                تنظیمات
              </NavLink>
            </>
          )}
          {isAdmin && (
            <>
              <NavLink to="/audit" onClick={closeMenu} className={({ isActive }) => `${navBase} ${isActive ? "bg-brand-500" : "hover:bg-brand-700"}`}>
                گزارش ممیزی
              </NavLink>
              <NavLink to="/users" onClick={closeMenu} className={({ isActive }) => `${navBase} ${isActive ? "bg-brand-500" : "hover:bg-brand-700"}`}>
                مدیریت کاربران
              </NavLink>
            </>
          )}
        </nav>

        <div className="space-y-3">
          <div className="text-sm text-brand-100">
            <div>{username}</div>
            <div>{role}</div>
          </div>
          <button className="btn-secondary w-full" onClick={logout}>
            خروج
          </button>
        </div>
      </aside>

      <main className="p-3 sm:p-4">
        <header className="card px-3 py-3 sm:px-4 mb-4 flex items-center justify-between gap-3">
          <button className="btn-secondary lg:hidden" onClick={() => setMenuOpen(true)} aria-label="باز کردن منو">
            منو
          </button>
          <div>
            <h2 className="text-lg font-semibold">{meta.title}</h2>
            <p className="text-sm text-slate-500">{meta.subtitle}</p>
          </div>
          <div className="text-xs text-slate-500 text-left">
            <div>کاربر: {username}</div>
            <div>نقش: {role}</div>
          </div>
        </header>
        <Outlet />
      </main>
    </div>
  );
}
