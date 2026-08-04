import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { API_BASE } from "@/lib/apiBase";
import { Truck, ShieldAlert, ArrowUpCircle, UserCircle2 } from "lucide-react";
import { toast } from "sonner";
import DispatchPanel from "@/components/ops/DispatchPanel";
import EtaAccuracyPanel from "@/components/ops/EtaAccuracyPanel";

const ADMIN_TOKEN_KEY = "tanmatra:admin-token:v1";

async function deliveryFetch<T>(path: string, init: RequestInit, token: string): Promise<T> {
  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...(init.headers ?? {}),
  };
  if (token) (headers as Record<string, string>)["x-admin-token"] = token;
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    ...init,
    headers,
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${await res.text().catch(() => "")}`);
  }
  return res.json() as Promise<T>;
}

export default function AdminDelivery() {
  const [token, setToken] = useState(
    typeof window === "undefined"
      ? ""
      : (window.localStorage.getItem(ADMIN_TOKEN_KEY) ?? "")
  );

  const [riderId, setRiderId] = useState("");
  const [riderStatus, setRiderStatus] = useState("online");
  const [updatingRider, setUpdatingRider] = useState(false);

  const [orderId, setOrderId] = useState("");
  const [priority, setPriority] = useState("urgent");
  const [priorityReason, setPriorityReason] = useState("");
  const [updatingPriority, setUpdatingPriority] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(ADMIN_TOKEN_KEY, token);
    }
  }, [token]);

  const handleUpdateRider = async () => {
    const id = parseInt(riderId, 10);
    if (!Number.isFinite(id)) {
      toast.error("Valid Numeric Rider ID required.");
      return;
    }
    setUpdatingRider(true);
    try {
      await deliveryFetch("/delivery/rider/availability", {
        method: "POST",
        body: JSON.stringify({ riderId: id, status: riderStatus }),
      }, token);
      toast.success(`Rider ${id} status updated to ${riderStatus}`);
      setRiderId("");
    } catch (err) {
      toast.error((err as Error).message || "Failed to update rider");
    } finally {
      setUpdatingRider(false);
    }
  };

  const handleUpdatePriority = async () => {
    const id = parseInt(orderId, 10);
    if (!Number.isFinite(id)) {
      toast.error("Valid Numeric Order ID required.");
      return;
    }
    setUpdatingPriority(true);
    try {
      await deliveryFetch(`/delivery/orders/${id}/priority`, {
        method: "POST",
        body: JSON.stringify({ priority, reason: priorityReason || undefined }),
      }, token);
      toast.success(`Order ${id} priority updated to ${priority}`);
      setOrderId("");
      setPriorityReason("");
    } catch (err) {
      toast.error((err as Error).message || "Failed to update priority");
    } finally {
      setUpdatingPriority(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between border-b border-clinical-border pb-4">
        <div>
          <h1 className="text-2xl font-serif text-white flex items-center gap-2">
            <Truck className="w-6 h-6 text-clinical-gold" />
            Delivery & Dispatch
          </h1>
          <p className="text-xs text-clinical-zinc mt-1">
            Manage dispatch, rider availability, ETA models, and order prioritization.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Input
            type="password"
            placeholder="Admin token"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            className="w-48 bg-clinical-dark border-clinical-border text-white text-xs h-9"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center justify-between gap-2">
                <span className="flex items-center gap-2">
                  <UserCircle2 className="w-4 h-4" />
                  Rider Availability
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="text-xs text-clinical-zinc">
                Update a rider's status to trigger auto-dispatch if they come online.
              </div>
              <div className="flex gap-2">
                <Input
                  placeholder="Rider ID"
                  value={riderId}
                  onChange={(e) => setRiderId(e.target.value)}
                  className="h-8 text-xs"
                />
                <Select value={riderStatus} onValueChange={setRiderStatus}>
                  <SelectTrigger className="w-[120px] h-8 text-xs">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="online">Online</SelectItem>
                    <SelectItem value="offline">Offline</SelectItem>
                    <SelectItem value="break">Break</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button
                size="sm"
                className="w-full h-8 text-xs bg-clinical-gold text-action-text hover:bg-clinical-gold/90"
                onClick={handleUpdateRider}
                disabled={updatingRider || !riderId}
              >
                {updatingRider ? "Updating..." : "Update Status"}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <ArrowUpCircle className="w-4 h-4 text-orange-400" />
                Order Priority Management
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="text-xs text-clinical-zinc">
                Escalate order priority. Priority promotions may preempt scheduled dispatch blocks.
              </div>
              <div className="flex gap-2">
                <Input
                  placeholder="Order ID"
                  value={orderId}
                  onChange={(e) => setOrderId(e.target.value)}
                  className="h-8 text-xs"
                />
                <Select value={priority} onValueChange={setPriority}>
                  <SelectTrigger className="w-[120px] h-8 text-xs">
                    <SelectValue placeholder="Priority" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="routine">Routine</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                    <SelectItem value="stat">Stat</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Input
                placeholder="Reason (required for stat/urgent)"
                value={priorityReason}
                onChange={(e) => setPriorityReason(e.target.value)}
                className="h-8 text-xs"
              />
              <Button
                size="sm"
                className="w-full h-8 text-xs"
                variant="outline"
                onClick={handleUpdatePriority}
                disabled={updatingPriority || !orderId}
              >
                {updatingPriority ? "Updating..." : "Change Priority"}
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <DispatchPanel />
          <EtaAccuracyPanel />
        </div>
      </div>
    </div>
  );
}
