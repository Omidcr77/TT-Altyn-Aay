import { Link } from "react-router-dom";

export function NotFoundPage() {
  return (
    <section className="min-h-screen grid place-items-center px-4">
      <div className="card p-6 text-center max-w-md">
        <h1 className="text-2xl font-bold mb-2">صفحه یافت نشد</h1>
        <p className="text-slate-500 mb-4">لینک وارد شده معتبر نیست.</p>
        <Link to="/" className="btn-primary">
          بازگشت به داشبورد
        </Link>
      </div>
    </section>
  );
}
