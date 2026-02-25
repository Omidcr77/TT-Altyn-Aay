export interface AuditItem {
  id: number;
  user_id: number | null;
  username: string | null;
  action: string;
  entity: string;
  entity_id: string;
  summary?: string;
  detail_json: string | null;
  undoable: boolean;
  created_at: string;
}

export interface AuditListPayload {
  items: AuditItem[];
  total: number;
  page: number;
  page_size: number;
}

export interface AuditUndoPayload {
  undone: boolean;
  action: string;
  activity_id: number;
}
