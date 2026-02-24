export function LoadingScreen({ message }: { message: string }) {
  return (
    <div className="min-h-screen grid place-items-center bg-slate-100">
      <div className="card px-6 py-4 text-slate-700">{message}</div>
    </div>
  );
}
