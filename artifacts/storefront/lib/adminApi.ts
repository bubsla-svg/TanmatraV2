import { apiGet, apiPost, type FetchImpl } from "./apiClient";

export interface AdminUser {
  id: string;
  email: string | null;
  phone: string | null;
  roles: string[];
}

export function getAdminUser(fetchImpl?: FetchImpl): Promise<{ user: AdminUser | null }> {
  return apiGet("/admin/me", fetchImpl);
}

export function logoutAdmin(fetchImpl?: FetchImpl): Promise<{ success: boolean }> {
  return apiPost("/admin/logout", {}, fetchImpl);
}

export function loginAdmin(
  input: { username: string; password: string },
  fetchImpl?: FetchImpl
): Promise<{ ok: boolean; error?: string }> {
  return apiPost("/admin/login", input, fetchImpl);
}
