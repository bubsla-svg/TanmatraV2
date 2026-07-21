import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { API_BASE } from "@/lib/apiBase";
import { useMenuCatalog, type DishData } from "@/lib/menuData";
import { AlertTriangle, CheckCircle2, Scale, Clock, ShieldAlert } from "lucide-react";
import { toast } from "sonner";

const ADMIN_TOKEN_KEY = "tanmatra:admin-token:v1";

interface KdsOrder {
  id: number;
  externalOrderId: string;
  status: "placed" | "preparing" | "ready";
  items: Array<{ id: number; name: string; qty: number; price: number }>;
  createdAt: string;
}

async function kdsFetch<T>(path: string, init: RequestInit, token: string): Promise<T> {
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

// Parse grams from ingredient text (e.g. "Beetroot – 80 g" -> 80)
function parseGrams(text: string): number {
  const match = text.match(/(\d+)\s*g/i);
  return match ? parseInt(match[1], 10) : 0;
}

export default function AdminKds() {
  const { dishes: catalog } = useMenuCatalog();
  const [orders, setOrders] = useState<KdsOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [token, setToken] = useState(
    typeof window === "undefined"
      ? ""
      : (window.localStorage.getItem(ADMIN_TOKEN_KEY) ?? ""),
  );

  // Measured weight state map: lineId/itemId -> measured weight string
  const [measuredWeights, setMeasuredWeights] = useState<Record<string, string>>({});
  const [busyOrderId, setBusyOrderId] = useState<number | null>(null);

  const loadOrders = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const data = await kdsFetch<{ orders: KdsOrder[] }>("/ops/kds/orders", {}, token);
      setOrders(data.orders);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void loadOrders();
  }, [loadOrders]);

  const handlePackReady = async (orderId: number) => {
    setBusyOrderId(orderId);
    try {
      await kdsFetch(`/ops/kds/orders/${orderId}/ready`, { method: "POST" }, token);
      toast.success(`Order #${orderId} marked as Ready for Dispatch`);
      void loadOrders();
    } catch (err) {
      toast.error((err as Error).message || "Verification failed");
    } finally {
      setBusyOrderId(null);
    }
  };

  const handleSimulateDelay = async (orderId: number) => {
    setBusyOrderId(orderId);
    try {
      await kdsFetch(`/ops/kds/orders/${orderId}/simulate-delay`, { method: "POST" }, token);
      toast.success("CRM Delay Alert SMS sent to customer!");
      void loadOrders();
    } catch (err) {
      toast.error((err as Error).message || "Delay simulation failed");
    } finally {
      setBusyOrderId(null);
    }
  };

  // Helper: compute recipe target weight and macro deviation
  const evaluateItemWeight = useCallback((dishId: number, measuredWeightGrams: number) => {
    const dish = catalog.find((c: DishData) => c.id === dishId);
    if (!dish) return null;

    // Sum up the gram-level ingredients in the recipe
    const plannedWeight = dish.ingredients
      .map(parseGrams)
      .reduce((sum: number, current: number) => sum + current, 0);

    if (plannedWeight === 0) return { plannedWeight: 0, deviation: 0, isWithinLimit: true, actualMacros: dish.macros };

    const ratio = measuredWeightGrams / plannedWeight;
    const actualMacros = {
      protein: Math.round(dish.macros.protein * ratio * 10) / 10,
      carbs: Math.round(dish.macros.carbs * ratio * 10) / 10,
      fat: Math.round(dish.macros.fat * ratio * 10) / 10,
    };

    const deviation =
      Math.abs(dish.macros.protein - actualMacros.protein) +
      Math.abs(dish.macros.carbs - actualMacros.carbs) +
      Math.abs(dish.macros.fat - actualMacros.fat);

    const isWithinLimit = deviation <= 2.0;

    return {
      plannedWeight,
      deviation: Math.round(deviation * 100) / 100,
      isWithinLimit,
      actualMacros,
    };
  }, [catalog]);

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center justify-between border-b border-white/[0.08] pb-4">
        <div>
          <h1 className="text-2xl font-serif text-white flex items-center gap-2">
            <Scale className="w-6 h-6 text-nn-primary" />
            Kitchen Display System (KDS) Simulator
          </h1>
          <p className="text-xs text-nn-on-surface-variant mt-1">
            ISO 22000 weight verification scale panel. Auto-locks packing if macro deviation D &gt; 2g.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Input
            type="password"
            placeholder="Admin token"
            value={token}
            onChange={(e) => {
              setToken(e.target.value);
              localStorage.setItem(ADMIN_TOKEN_KEY, e.target.value);
            }}
            className="w-48 bg-nn-bg border-white/[0.08] text-white text-xs h-9"
          />
          <Button size="sm" variant="outline" onClick={loadOrders} className="h-9">
            Refresh
          </Button>
        </div>
      </div>

      {error && (
        <Card className="border-red-500/30 bg-red-500/5">
          <CardContent className="p-4 flex items-center gap-2 text-red-400 text-xs">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <div className="text-center py-12 text-nn-on-surface-variant text-xs">Loading orders...</div>
      ) : orders.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-white/[0.08] rounded-xl">
          <CheckCircle2 className="w-8 h-8 text-nn-on-surface-variant/40 mx-auto mb-2" />
          <p className="text-sm text-nn-on-surface-variant">All orders cleared. No pending prep tickets.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {orders.map((order) => {
            // Verify if ALL items in the order are calibrated and within limits
            let orderIsCalibrated = true;
            let missingCalibration = false;

            const elapsedMs = Date.now() - new Date(order.createdAt).getTime();
            const elapsedMin = Math.floor(elapsedMs / 60_000);
            const isDelayed = elapsedMin >= 20;

            return (
              <Card key={order.id} className={`bg-nn-surface flex flex-col justify-between ${isDelayed ? 'border-red-500/60 border-2 shadow-[0_0_15px_rgba(239,68,68,0.1)]' : 'border-white/[0.08]'}`}>
                <CardHeader className="border-b border-white/[0.04] py-3 px-4 flex flex-row items-center justify-between">
                  <div className="space-y-0.5">
                    <CardTitle className="text-sm font-semibold text-white flex items-center gap-2">
                      Order ID: {order.externalOrderId.slice(0, 8)}
                      {isDelayed && (
                        <span className="w-2 h-2 rounded-full bg-red-500 animate-ping inline-block" />
                      )}
                    </CardTitle>
                    <span className="text-[10px] text-nn-on-surface-variant flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {new Date(order.createdAt).toLocaleTimeString()}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {isDelayed && (
                      <Badge className="bg-red-500 text-black border-0 text-[9px] uppercase font-bold px-1.5 h-5 flex items-center">
                        SLA Delay ({elapsedMin}m)
                      </Badge>
                    )}
                    <Badge variant="outline" className="border-nn-primary/30 text-nn-primary text-[9px] uppercase">
                      {order.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="p-4 flex-1 space-y-4">
                  {order.items.map((item) => {
                    const dish = catalog.find((c: DishData) => c.id === item.id);
                    const weightKey = `${order.id}-${item.id}`;
                    const measuredWeightStr = measuredWeights[weightKey] || "";
                    const measuredWeight = parseFloat(measuredWeightStr) || 0;

                    const evalResult = measuredWeight > 0 ? evaluateItemWeight(item.id, measuredWeight) : null;

                    if (!evalResult) {
                      orderIsCalibrated = false;
                      missingCalibration = true;
                    } else if (!evalResult.isWithinLimit) {
                      orderIsCalibrated = false;
                    }

                    return (
                      <div key={item.id} className="p-3 rounded-lg bg-nn-bg/40 border border-white/[0.04] space-y-3">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <h4 className="text-xs font-semibold text-white">{item.name}</h4>
                            <span className="text-[10px] text-nn-on-surface-variant">Qty: {item.qty}</span>
                          </div>
                          {dish && (
                            <div className="text-[9px] font-mono text-nn-on-surface-variant text-right">
                              Target Macros: {dish.macros.protein}P / {dish.macros.carbs}C / {dish.macros.fat}F
                            </div>
                          )}
                        </div>

                        {dish && (
                          <div className="space-y-1.5">
                            <span className="text-[9px] font-semibold uppercase tracking-wider text-nn-on-surface-variant">
                              Gram Prep Instructions:
                            </span>
                            <ul className="text-[10px] text-nn-on-surface-variant leading-relaxed list-disc list-inside">
                              {dish.ingredients.map((ing: string, i: number) => (
                                <li key={i}>{ing}</li>
                              ))}
                            </ul>
                          </div>
                        )}

                        <div className="grid grid-cols-2 gap-3 pt-2 border-t border-white/[0.024]">
                          <div>
                            <label className="text-[9px] uppercase tracking-wider text-nn-on-surface-variant block mb-1">
                              Scale Weight (grams)
                            </label>
                            <div className="flex items-center gap-1.5">
                              <Input
                                type="number"
                                placeholder="0"
                                value={measuredWeightStr}
                                onChange={(e) => {
                                  setMeasuredWeights((prev) => ({
                                    ...prev,
                                    [weightKey]: e.target.value,
                                  }));
                                }}
                                className="bg-nn-bg border-white/[0.08] text-white text-xs h-7 w-24 tabular-nums"
                              />
                              <span className="text-[10px] text-nn-on-surface-variant">g</span>
                            </div>
                          </div>

                          <div className="flex flex-col justify-end">
                            {evalResult ? (
                              <div className="space-y-1 text-right">
                                <span className="text-[9px] text-nn-on-surface-variant block">
                                  Target: {evalResult.plannedWeight}g | Deviation:{" "}
                                  <span
                                    className={
                                      evalResult.isWithinLimit
                                        ? "text-clinical-sage font-bold"
                                        : "text-red-400 font-bold"
                                    }
                                  >
                                    {evalResult.deviation}g
                                  </span>
                                </span>
                                {evalResult.isWithinLimit ? (
                                  <span className="text-[10px] text-clinical-sage font-medium inline-flex items-center gap-0.5">
                                    ✓ Target Verified
                                  </span>
                                ) : (
                                  <span className="text-[10px] text-red-400 font-medium inline-flex items-center gap-0.5">
                                    ⚠️ Macro Deviation Out of Bound
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-[10px] text-nn-on-surface-variant/60 italic text-right self-end pb-1.5">
                                Awaiting measured weight...
                              </span>
                            )}
                          </div>
                        </div>

                        {evalResult && !evalResult.isWithinLimit && (
                          <div className="p-2 rounded bg-red-500/10 border border-red-500/20 text-[10px] text-red-400 leading-normal flex items-start gap-1.5">
                            <ShieldAlert className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                            <div>
                              <strong className="text-white block">Macro Mismatch:</strong>
                              Planned macros: {dish?.macros.protein}P / {dish?.macros.carbs}C / {dish?.macros.fat}F.
                              Actual: {evalResult.actualMacros.protein}P / {evalResult.actualMacros.carbs}C / {evalResult.actualMacros.fat}F.
                              Please adjust portion sizing.
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </CardContent>
                <div className="border-t border-white/[0.08] p-3 bg-nn-bg/10 flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1 h-9 border-red-500/30 hover:bg-red-500/10 text-red-400 font-semibold text-xs"
                    disabled={busyOrderId !== null}
                    onClick={() => handleSimulateDelay(order.id)}
                  >
                    Simulate Delay
                  </Button>
                  <Button
                    size="sm"
                    className="flex-[2] h-9 bg-nn-primary text-action-text hover:bg-nn-primary/90 font-bold uppercase tracking-wider text-xs disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={!orderIsCalibrated || busyOrderId !== null}
                    onClick={() => handlePackReady(order.id)}
                  >
                    {busyOrderId === order.id
                      ? "Verifying..."
                      : missingCalibration
                      ? "Awaiting scale inputs"
                      : !orderIsCalibrated
                      ? "Macro Limits Exceeded (Locked)"
                      : "Pack & Verify (Ready)"}
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
