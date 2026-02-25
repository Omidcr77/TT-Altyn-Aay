import { useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/app/AuthContext";

export function LoginPage() {
  const { login, isAuthenticated } = useAuth();
  const location = useLocation();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (isAuthenticated) return <Navigate to="/" replace />;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(username, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "ورود ناموفق بود");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid place-items-center px-4">
      <form onSubmit={handleSubmit} className="card w-full max-w-md p-5 space-y-3">
        <h1 className="text-xl font-bold">ورود</h1>
        <p className="text-sm text-slate-500">برای ادامه وارد حساب شوید</p>
        <div>
          <label className="text-sm text-slate-600">نام کاربری</label>
          <input className="input mt-1" autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} />
        </div>
        <div>
          <label className="text-sm text-slate-600">رمز عبور</label>
          <input className="input mt-1" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        {error && <div className="text-sm text-red-600">{error}</div>}
        <button className="btn-primary w-full" disabled={loading}>
          {loading ? "در حال ورود..." : "ورود"}
        </button>
        <p className="text-xs text-slate-400">مسیر فعلی: {location.pathname}</p>
      </form>
    </div>
  );
}
