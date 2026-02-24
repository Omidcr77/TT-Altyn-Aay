import { Route, Routes } from "react-router-dom";
import { AuthProvider } from "./AuthContext";
import { NotificationsProvider } from "./NotificationsContext";
import { AppShell } from "@/components/AppShell";
import { RequireAuth } from "@/routes/RequireAuth";
import { RequireRole } from "@/routes/RequireRole";
import { LoginPage } from "@/pages/LoginPage";
import { DashboardPage } from "@/pages/DashboardPage";
import { ActivitiesPage } from "@/pages/ActivitiesPage";
import { NewActivityPage } from "@/pages/NewActivityPage";
import { NotificationsPage } from "@/pages/NotificationsPage";
import { StaffPage } from "@/pages/StaffPage";
import { SettingsPage } from "@/pages/SettingsPage";
import { AuditPage } from "@/pages/AuditPage";
import { NotFoundPage } from "@/pages/NotFoundPage";
import { ErrorBoundary } from "@/components/ErrorBoundary";

export default function App() {
  return (
    <AuthProvider>
      <NotificationsProvider>
        <ErrorBoundary>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route
              path="/"
              element={
                <RequireAuth>
                  <AppShell />
                </RequireAuth>
              }
            >
              <Route index element={<DashboardPage />} />
              <Route path="activities" element={<ActivitiesPage />} />
              <Route path="new-activity" element={<NewActivityPage />} />
              <Route path="notifications" element={<NotificationsPage />} />
              <Route
                path="staff"
                element={
                  <RequireRole allow={["admin", "manager"]}>
                    <StaffPage />
                  </RequireRole>
                }
              />
              <Route
                path="settings"
                element={
                  <RequireRole allow={["admin", "manager"]}>
                    <SettingsPage />
                  </RequireRole>
                }
              />
              <Route
                path="audit"
                element={
                  <RequireRole allow={["admin"]}>
                    <AuditPage />
                  </RequireRole>
                }
              />
            </Route>
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </ErrorBoundary>
      </NotificationsProvider>
    </AuthProvider>
  );
}
