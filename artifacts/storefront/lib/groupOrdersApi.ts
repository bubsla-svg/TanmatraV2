import { apiGet, apiPost, type FetchImpl } from "@/lib/apiClient";

/**
 * Group-order client (route-parity Wave E). A share code opens a group anyone
 * can add their own picks to; the host closes it and pays for everyone. The READ
 * is public (an invitee previews before signing in); add/remove/close need a
 * session. Adding a pick happens on /menu?group=CODE (deferred here); this page
 * is view / share / remove / (host) close-&-checkout.
 */

export interface GroupOrderLine {
  lineId: string;
  dishId: number;
  name: string;
  image: string;
  unitPrice: number;
  quantity: number;
  customizations: string[];
  addedBy: string;
  addedByName: string;
}

export interface GroupParticipant {
  id: string;
  name: string;
}

export interface GroupOrder {
  id: number;
  code: string;
  hostUserId: string | null;
  hostName: string;
  status: "open" | "closed";
  items: GroupOrderLine[];
  participants: GroupParticipant[];
  createdAt: string;
  updatedAt: string;
  closedAt: string | null;
}

export function getGroup(code: string, fetchImpl?: FetchImpl): Promise<{ group: GroupOrder }> {
  return apiGet(`/group-orders/${encodeURIComponent(code)}`, fetchImpl);
}

export function removeLine(code: string, lineId: string, fetchImpl?: FetchImpl): Promise<{ group: GroupOrder }> {
  return apiPost(`/group-orders/${encodeURIComponent(code)}/remove-line`, { lineId }, fetchImpl);
}

export function closeGroup(code: string, fetchImpl?: FetchImpl): Promise<{ group: GroupOrder }> {
  return apiPost(`/group-orders/${encodeURIComponent(code)}/close`, {}, fetchImpl);
}

export function groupSubtotalPaise(group: GroupOrder): number {
  return group.items.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0);
}
