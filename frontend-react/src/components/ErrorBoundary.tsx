import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = {
    hasError: false,
    message: ""
  };

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      message: error.message || "خطای غیرمنتظره رخ داده است."
    };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Surface component stack in dev tools for easier debugging.
    // eslint-disable-next-line no-console
    console.error("Unhandled UI error:", error, info);
  }

  private handleReload = () => {
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <section className="min-h-screen grid place-items-center bg-slate-100 p-4">
        <div className="card max-w-xl w-full p-5 space-y-3">
          <h1 className="text-xl font-semibold text-red-700">خطا در بارگذاری صفحه</h1>
          <p className="text-sm text-slate-700">{this.state.message}</p>
          <div className="flex flex-wrap gap-2">
            <button className="btn-primary" onClick={this.handleReload}>
              تلاش دوباره
            </button>
            <button className="btn-secondary" onClick={() => (window.location.href = "/")}>
              بازگشت به داشبورد
            </button>
          </div>
        </div>
      </section>
    );
  }
}
