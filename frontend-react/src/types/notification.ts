export interface NotificationItem {
  id: number;
  activity_id: number | null;
  type: string;
  text: string;
  read_at: string | null;
  created_at: string;
}

export interface NotificationPayload {
  items: NotificationItem[];
  unread_count: number;
}
