# TT Altyn Aay App

Ø§Ù¾Ù„ÛŒÚ©ÛŒØ´Ù† Ú©Ø§Ù…Ù„ Ù…Ø¯ÛŒØ±ÛŒØª ÙØ¹Ø§Ù„ÛŒØªâ€ŒÙ‡Ø§/Ú¯Ø²Ø§Ø±Ø´ Ø¨Ø§ FastAPI + SQLite + Vanilla JS (RTL, Dari).

## Ù…Ø´Ø®ØµØ§Øª
- Ø§Ø­Ø±Ø§Ø² Ù‡ÙˆÛŒØª JWT Ø¨Ø§ Ù†Ù‚Ø´ `admin` Ùˆ `user`
- CRUD Ú©Ø§Ù…Ù„ ÙØ¹Ø§Ù„ÛŒØªâ€ŒÙ‡Ø§ Ø¨Ø§ `extra_fields` (JSON)
- Ø¯Ø§Ø´Ø¨ÙˆØ±Ø¯ Ø¢Ù…Ø§Ø±ÛŒ (Ø§Ù…Ø±ÙˆØ²/Ù‡ÙØªÙ‡/Ø¯Ø± Ø§Ù†ØªØ¸Ø§Ø±/Ø§Ù†Ø¬Ø§Ù… Ø´Ø¯/Ø¨Ø± Ø§Ø³Ø§Ø³ Ù†ÙˆØ¹/Ú©Ø§Ø±Ù…Ù†Ø¯)
- Ø§Ø¹Ù„Ø§Ù† Ø¯Ø§Ø®Ù„ÛŒ real-time Ø¨Ø§ WebSocket
- Ø§Ø¹Ù„Ø§Ù† Ø§ÛŒÙ…ÛŒÙ„ Ø§Ø®ØªÛŒØ§Ø±ÛŒ (Stub Ù‚Ø§Ø¨Ù„ ØªÙ†Ø¸ÛŒÙ…)
- Ù…Ø¯ÛŒØ±ÛŒØª Ú©Ø§Ø±Ù…Ù†Ø¯Ø§Ù† Ùˆ Ø¯Ø§Ø¯Ù‡â€ŒÙ‡Ø§ÛŒ Ù¾Ø§ÛŒÙ‡ (Ù†ÙˆØ¹ ÙØ¹Ø§Ù„ÛŒØª/Ù†ÙˆØ¹ Ø¯Ø³ØªÚ¯Ø§Ù‡/Ù…ÙˆÙ‚Ø¹ÛŒØª)
- Ú¯Ø²Ø§Ø±Ø´ Ù…Ù…ÛŒØ²ÛŒ (Audit Trail)
- Ø¬Ø³ØªØ¬ÙˆØŒ ÙÛŒÙ„ØªØ±ØŒ ØµÙØ­Ù‡â€ŒØ¨Ù†Ø¯ÛŒØŒ Ù¾ÛŒØ´Ù†Ù‡Ø§Ø¯ Ø®ÙˆØ¯Ú©Ø§Ø±
- Ø®Ø±ÙˆØ¬ÛŒ CSV/Excel
- Ù‡Ù…Ú¯Ø§Ù…â€ŒØ³Ø§Ø²ÛŒ Ø®ÙˆØ¯Ú©Ø§Ø± `activities.xlsx` Ø¨Ø§ `openpyxl`

## Ø³Ø§Ø®ØªØ§Ø± Ù¾Ø±ÙˆÚ˜Ù‡
```text
TT Altyn Aay/
  backend/
    app/
      __init__.py
      api_utils.py
      auth.py
      config.py
      database.py
      deps.py
      main.py
      models.py
      schemas.py
      routers/
        __init__.py
        activities.py
        audit.py
        auth.py
        dashboard.py
        exports.py
        master_data.py
        notifications.py
        staff.py
        suggestions.py
      services/
        __init__.py
        audit_service.py
        email_service.py
        excel_service.py
        notification_service.py
        seed_service.py
  frontend/
    index.html
    css/
      reset.css
      style.css
    js/
      api.js
      app.js
      auth.js
      components.js
      utils.js
  requirements.txt
  README.md
  .gitignore
```

## Ù†ØµØ¨ Ùˆ Ø§Ø¬Ø±Ø§
1. Ø³Ø§Ø®Øª venv:
```powershell
python -m venv .venv
```

2. ÙØ¹Ø§Ù„â€ŒØ³Ø§Ø²ÛŒ venv:
```powershell
.venv\Scripts\Activate.ps1
```

3. Ù†ØµØ¨ Ú©ØªØ§Ø¨Ø®Ø§Ù†Ù‡â€ŒÙ‡Ø§:
```powershell
pip install -r requirements.txt
```

4. Ø§Ø¬Ø±Ø§ÛŒ Ø³Ø±ÙˆØ±:
```powershell
uvicorn backend.app.main:app --reload
```

5. Ø¨Ø§Ø² Ú©Ø±Ø¯Ù† Ø¨Ø±Ù†Ø§Ù…Ù‡:
```text
http://127.0.0.1:8000
```

## Ø­Ø³Ø§Ø¨â€ŒÙ‡Ø§ÛŒ Ù¾ÛŒØ´â€ŒÙØ±Ø¶ (Seed)
- Admin:
  - username: `admin`
  - password: `Admin@12345`
- User:
  - username: `user1`
  - password: `User@12345`

> Ø¯Ø± Ø§ÙˆÙ„ÛŒÙ† Ø§Ø¬Ø±Ø§ Ø¬Ø¯ÙˆÙ„â€ŒÙ‡Ø§ Ø³Ø§Ø®ØªÙ‡ Ù…ÛŒâ€ŒØ´ÙˆÙ†Ø¯ØŒ Ø¯Ø§Ø¯Ù‡â€ŒÙ‡Ø§ÛŒ Ù¾Ø§ÛŒÙ‡ seed Ù…ÛŒâ€ŒØ´ÙˆÙ†Ø¯ØŒ Ø­Ø¯Ø§Ù‚Ù„ 10 ÙØ¹Ø§Ù„ÛŒØª Ù†Ù…ÙˆÙ†Ù‡ Ø¯Ø±Ø¬ Ù…ÛŒâ€ŒØ´ÙˆØ¯ØŒ Ùˆ ÙØ§ÛŒÙ„ `activities.xlsx` Ø¯Ø± Ø±ÛŒØ´Ù‡ Ù¾Ø±ÙˆÚ˜Ù‡ Ø³Ø§Ø®ØªÙ‡/Ø¨Ù‡â€ŒØ±ÙˆØ²Ø±Ø³Ø§Ù†ÛŒ Ù…ÛŒâ€ŒÚ¯Ø±Ø¯Ø¯.

## Ù†Ú©Ø§Øª Ø§Ù…Ù†ÛŒØªÛŒ
- Ù‡Ø´ Ø±Ù…Ø² Ø¹Ø¨ÙˆØ± Ø¨Ø§ `bcrypt`
- Ú©Ù†ØªØ±Ù„ Ø¯Ø³ØªØ±Ø³ÛŒ Ù†Ù‚Ø´â€ŒÙ…Ø­ÙˆØ± Ø¯Ø± ØªÙ…Ø§Ù… APIÙ‡Ø§ÛŒ Ø­Ø³Ø§Ø³
- Ù…Ø­Ø¯ÙˆØ¯ÛŒØª ØªÙ„Ø§Ø´ ÙˆØ±ÙˆØ¯ (basic rate limit)
- Ø§Ø¹ØªØ¨Ø§Ø±Ø³Ù†Ø¬ÛŒ ÙˆØ±ÙˆØ¯ÛŒ Ø¯Ø± backend
- Ù‚Ø§Ù„Ø¨ Ø§Ø³ØªØ§Ù†Ø¯Ø§Ø±Ø¯ Ø®Ø·Ø§ Ø¯Ø± Ù¾Ø§Ø³Ø®â€ŒÙ‡Ø§

## UI Screenshot Notes (New Admin Dashboard)

### 1) Login Screen
- Centered auth card on an off-white background.
- TT Altyn Aay App title, username/password fields, and a primary login button.
- RTL form layout with visible focus states.

### 2) Dashboard (Ø¯Ø§Ø´Ø¨ÙˆØ±Ø¯)
- Fixed right sidebar with Dari navigation.
- Sticky top header with global search, notification bell (badge), and profile menu.
- KPI cards: pending, done, today, this week.
- Two clean bar-chart panels (activity by type, activity by staff) without external chart library.
- Recent activities table in enterprise card style.

### 3) Activities (ÙØ¹Ø§Ù„ÛŒØª Ù‡Ø§)
- Default tab is Pending with tab counts for Pending/Done.
- Collapsible filter panel: date from/to, status, staff, activity type, location, and search.
- Sticky-header data table with sorting (date/status), pagination, row action dropdown.
- Status pills: pending (amber), done (green), overdue (red + "Ù…Ø¹Ø·Ù„").
- Mobile view transforms rows into card-like stacked records.

### 4) Add Activity (Ø§ÙØ²ÙˆØ¯Ù† ÙØ¹Ø§Ù„ÛŒØª)
- Grouped form sections:
  - Ù…Ø¹Ù„ÙˆÙ…Ø§Øª Ù…Ø´ØªØ±ÛŒ
  - Ø¬Ø²Ø¦ÛŒØ§Øª ÙØ¹Ø§Ù„ÛŒØª
  - ØªØ¹ÛŒÛŒÙ† Ú©Ø§Ø±Ù…Ù†Ø¯
- Required fields, inline validation messages in Dari.
- Typeahead/autocomplete for customer and address.
- Staff quick filter/typeahead.
- Draft autosave in localStorage.

### 5) Notifications (Ø§Ø¹Ù„Ø§Ù† Ù‡Ø§)
- Notification center list with read/unread actions.
- "Ù…Ø´Ø§Ù‡Ø¯Ù‡ ÙØ¹Ø§Ù„ÛŒØª" action opens activity details quickly.
- Same visual system as other pages for consistency.

### 6) Staff (Ú©Ø§Ø±Ù…Ù†Ø¯Ø§Ù†, Admin)
- Staff add form and table with active/inactive toggle actions.
- Reuses global table and button system.

### 7) Settings (ØªÙ†Ø¸ÛŒÙ…Ø§Øª, Admin)
- Master data management card with add/delete rows.
- Email notification settings card (enabled + recipients).
- Consistent enterprise spacing, borders, and typography.

### 8) Global UI Behaviors
- Subtle transitions (hover/focus/drawer/toast) in 150-220ms range.
- Modal and drawer support Escape-to-close.
- Theme switcher (manual toggle + localStorage) with dark mode variables.
- Real-time notification updates via WebSocket.

