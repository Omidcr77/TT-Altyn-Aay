export type AppRole = "admin" | "manager" | "staff" | "viewer";

export interface AppUser {
  id: number;
  username: string;
  role: AppRole;
  created_at: string;
}

export interface CreateUserPayload {
  username: string;
  password: string;
  role: AppRole;
}

export interface UpdateUserPayload {
  username?: string;
  password?: string;
  role?: AppRole;
}
