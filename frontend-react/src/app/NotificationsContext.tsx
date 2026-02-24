import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchNotifications } from "@/services/notifications";
import { getStoredAuth } from "@/services/authStorage";
import { useAuth } from "@/app/AuthContext";

interface NotificationsContextValue {
  unread: number;
  connected: boolean;
}

const NotificationsContext = createContext<NotificationsContextValue | null>(null);

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const { isAuthenticated } = useAuth();
  const pollTimerRef = useRef<number | null>(null);
  const pingTimerRef = useRef<number | null>(null);
  const [connected, setConnected] = useState(false);

  const notifQuery = useQuery({
    queryKey: ["notifications"],
    queryFn: () => fetchNotifications(false),
    enabled: isAuthenticated,
    refetchInterval: isAuthenticated ? 30_000 : false
  });

  useEffect(() => {
    if (!isAuthenticated) return;
    const auth = getStoredAuth();
    if (!auth?.access_token) return;

    const startPoll = () => {
      if (pollTimerRef.current) return;
      pollTimerRef.current = window.setInterval(() => {
        void queryClient.invalidateQueries({ queryKey: ["notifications"] });
      }, 20_000);
    };

    const stopPoll = () => {
      if (pollTimerRef.current) {
        window.clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };

    const stopPing = () => {
      if (pingTimerRef.current) {
        window.clearInterval(pingTimerRef.current);
        pingTimerRef.current = null;
      }
    };

    const proto = window.location.protocol === "https:" ? "wss" : "ws";
    const wsUrl = `${proto}://${window.location.host}/api/notifications/ws?token=${encodeURIComponent(auth.access_token)}`;
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      setConnected(true);
      stopPoll();
      pingTimerRef.current = window.setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) ws.send("ping");
      }, 25_000);
    };

    ws.onmessage = () => {
      void queryClient.invalidateQueries({ queryKey: ["notifications"] });
    };

    ws.onerror = () => {
      setConnected(false);
      startPoll();
      stopPing();
    };

    ws.onclose = () => {
      setConnected(false);
      startPoll();
      stopPing();
    };

    return () => {
      ws.close();
      stopPoll();
      stopPing();
    };
  }, [isAuthenticated, queryClient]);

  const value = useMemo<NotificationsContextValue>(
    () => ({
      unread: notifQuery.data?.unread_count ?? 0,
      connected
    }),
    [notifQuery.data?.unread_count, connected]
  );

  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
}

export function useNotificationsChannel() {
  const ctx = useContext(NotificationsContext);
  if (!ctx) throw new Error("useNotificationsChannel must be used inside NotificationsProvider");
  return ctx;
}
