import { apiGet, apiPost, type FetchImpl } from "./apiClient";

/**
 * Company / corporate-membership client (route-parity Wave E). Member-facing
 * surface over routes/corporate.ts. NOT to be confused with lib/corporateApi.ts
 * (the public lead-capture stub → /corporate-leads). No money-path here — office
 * picks are budget-enforced server-side; the server owns every dish price.
 */

export type CompanyMemberRole = "admin" | "member";
export type CompanyMemberStatus = "invited" | "active" | "removed";
export type OfficeOrderStatus = "open" | "closed" | "delivered" | "cancelled";

export interface Company {
  id: number;
  slug: string;
  name: string;
  perEmployeeMonthlyBudgetPaise: number;
}

export interface CompanyMember {
  id: number;
  companyId: number;
  userId: string | null;
  email: string;
  role: CompanyMemberRole;
  status: CompanyMemberStatus;
  joinedAt: string | null;
}

export interface OfficeOrderAddress { label?: string; line: string; city: string; pincode: string; phone?: string }

export interface OfficeOrderPickItem { dishId: number; name: string; image: string; unitPrice: number; quantity: number }

export interface OfficeOrderPick {
  userId: string;
  userName: string;
  pickedAt: string;
  items: OfficeOrderPickItem[];
  totalPaise: number;
}

export interface OfficeOrder {
  id: number;
  companyId: number;
  title: string;
  address: OfficeOrderAddress;
  perEmployeeBudgetPaise: number;
  scheduledFor: string;
  windowClosesAt: string;
  status: OfficeOrderStatus;
  picks: OfficeOrderPick[];
  totalPaise: number;
  closedAt: string | null;
}

export function getInvite(token: string, fetchImpl?: FetchImpl): Promise<{ invite: CompanyMember; company?: Company }> {
  return apiGet(`/companies/invites/${encodeURIComponent(token)}`, fetchImpl);
}

export function acceptInvite(token: string, fetchImpl?: FetchImpl): Promise<{ member?: CompanyMember; company?: Company; ok?: boolean; already?: boolean }> {
  return apiPost(`/companies/invites/${encodeURIComponent(token)}/accept`, {}, fetchImpl);
}

export function getCompany(slug: string, fetchImpl?: FetchImpl): Promise<{ company: Company; membership: CompanyMember | null; members: CompanyMember[] }> {
  return apiGet(`/companies/${encodeURIComponent(slug)}`, fetchImpl);
}

export function getCompanyOfficeOrders(slug: string, fetchImpl?: FetchImpl): Promise<{ officeOrders: OfficeOrder[] }> {
  return apiGet(`/companies/${encodeURIComponent(slug)}/office-orders`, fetchImpl);
}

export function getOfficeOrder(id: number, fetchImpl?: FetchImpl): Promise<{ officeOrder: OfficeOrder; membership: CompanyMember }> {
  return apiGet(`/office-orders/${id}`, fetchImpl);
}

export function pickOfficeOrder(id: number, items: { dishId: number; quantity: number }[], fetchImpl?: FetchImpl): Promise<{ officeOrder: OfficeOrder }> {
  return apiPost(`/office-orders/${id}/pick`, { items }, fetchImpl);
}

export function closeOfficeOrder(id: number, fetchImpl?: FetchImpl): Promise<{ officeOrder: OfficeOrder }> {
  return apiPost(`/office-orders/${id}/close`, {}, fetchImpl);
}

/** Whether the office-lunch pick window is still open right now. */
export function officeWindowOpen(o: OfficeOrder, now = Date.now()): boolean {
  return o.status === "open" && new Date(o.windowClosesAt).getTime() > now;
}
