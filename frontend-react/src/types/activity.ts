export interface StaffRef {
  id: number;
  name: string;
  phone?: string | null;
  active?: boolean;
}

export interface Activity {
  id: number;
  created_at?: string;
  updated_at?: string | null;
  created_by_user_id?: number;
  created_by_username?: string | null;
  done_by_user_id?: number | null;
  done_by_username?: string | null;
  done_at?: string | null;
  date: string;
  activity_type: string;
  customer_name: string;
  location: string;
  address?: string | null;
  status: "pending" | "done";
  priority: number;
  report_text?: string | null;
  device_info?: string | null;
  extra_fields?: Record<string, string | number | boolean | null>;
  assigned_staff: StaffRef[];
}

export interface ActivitiesResponse {
  items: Activity[];
  total: number;
  page: number;
  page_size: number;
}

export interface ActivityUpdatePayload {
  date?: string;
  activity_type?: string;
  customer_name?: string;
  location?: string;
  address?: string | null;
  report_text?: string | null;
  device_info?: string | null;
  priority?: number;
  status?: "pending" | "done";
  assigned_staff_ids?: number[];
  extra_fields?: Record<string, string | number | boolean | null>;
}

export interface ActivityCreatePayload {
  date: string;
  activity_type: string;
  customer_name: string;
  location?: string | null;
  address?: string | null;
  report_text?: string | null;
  device_info?: string | null;
  extra_fields?: Record<string, string | number | boolean | null>;
  assigned_staff_ids?: number[];
  priority?: number;
}
