# Frontend React (Phase 1)

This folder contains Phase 1 and early Phase 2 migration scaffold:

- React + TypeScript + Vite
- Tailwind CSS
- RTL + Dari font defaults
- Auth context + login flow
- Route guards:
  - `RequireAuth`
  - `RequireRole`
- App shell (sidebar + topbar)
- Initial pages connected to existing FastAPI backend
- TanStack Query provider
- Reusable UI:
  - `DataTable`
  - `Modal`
  - `ConfirmDialog`
  - `ToastProvider`
- Activities page migrated to Query + Mutation + reusable components

## Prerequisites

Install Node.js 20+ first (npm included).

## Run

```powershell
cd frontend-react
npm install
npm run dev
```

Then open:

```text
http://127.0.0.1:5173
```

Backend should remain running on:

```text
http://127.0.0.1:8000
```

## Notes

- API base is currently `""` (same origin). For split origins, add a proxy or env base URL in Phase 2.
- This phase is intentionally minimal and stable to prepare migration of full UX features in next phase.
