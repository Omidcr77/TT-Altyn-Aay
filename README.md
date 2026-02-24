# TT Altyn Aay App

Activity and operations management system with:
- FastAPI backend
- SQLite database
- React frontend (Vite + TypeScript)
- Legacy vanilla frontend (kept for reference)

## Main Features
- JWT authentication with role-based access (`admin`, `manager`, `user`)
- Activity CRUD with `extra_fields` JSON support
- Dashboard stats and trends
- Notifications API + WebSocket live channel
- Staff management
- Master data management
- Audit log
- CSV/Excel export and Excel import/validation
- Automatic sync with `activities.xlsx`

## Project Structure
```text
TT Altyn Aay/
  backend/
    app/
      main.py
      routers/
      services/
  frontend-react/
    src/
    package.json
  frontend/                 # legacy vanilla frontend
  tests/
  requirements.txt
  README.md
```

## Backend Setup
1. Create virtual environment:
```powershell
python -m venv .venv
```
2. Activate environment:
```powershell
.venv\Scripts\Activate.ps1
```
3. Install dependencies:
```powershell
pip install -r requirements.txt
```
4. Run API server:
```powershell
uvicorn backend.app.main:app --reload
```
5. Backend URL:
```text
http://127.0.0.1:8000
```

## React Frontend Setup
1. Install dependencies:
```powershell
cd frontend-react
npm install
```
2. Start dev server:
```powershell
npm run dev
```
3. Frontend URL:
```text
http://127.0.0.1:5173
```

Notes:
- Vite proxy is configured so `/api` and WebSocket traffic are forwarded to `http://127.0.0.1:8000` in dev mode.
- Production build:
```powershell
npm run build
```

## Default Seed Credentials
- Admin: `admin` / `Admin@12345`
- User: `user1` / `User@12345`

## Testing
From project root:
```powershell
$env:PYTHONPATH='.'
pytest -q
```

## Security Notes
- Password hashing uses bcrypt
- Login rate limiting is enabled
- Role checks are enforced on protected endpoints

## Current Status
- Core backend APIs available
- React frontend is the active UI
- Recent UX and accessibility updates include:
  - Responsive sidebar drawer
  - URL-synced activity filters
  - Improved table and pagination behavior
  - Modal focus trap + Escape handling
  - Route-level error boundary
