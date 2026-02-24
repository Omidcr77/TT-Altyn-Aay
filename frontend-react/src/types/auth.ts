export type UserRole = "admin" | "manager" | "staff" | "user";

export interface AuthPayload {
  access_token: string;
  refresh_token: string;
  token_type: string;
  role: UserRole;
  username: string;
}

export interface MeResponse {
  id: number;
  username: string;
  role: UserRole;
}
