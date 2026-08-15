import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { API_BASE } from "@/lib/apiBase";
import { Barcode, ClipboardList, PackagePlus } from "lucide-react";
import { toast } from "sonner";

const ADMIN_TOKEN_KEY = "tanmatra:admin-token:v1";

interface BarcodeCrate {
  barcodeToken: string;
  product: string;
  farmOrigin: string;
  harvestDate: string;
  batchCode: string;
  quantity: number;
}

interface StockItem {
  id: number;
  product: string;
  buyingQty: string;
  buyingPricePaise: number;
}

interface SupplierBatch {
  id: number;
  product: string;
  farmOrigin: string;
  harvestDate: string;
  batchCode: string;
  quantity: number;
  barcodeToken: string;
  status: string;
  createdAt: string;
}

export default function AdminSupplier() {
  const [token, setToken] = useState(
    typeof window === "undefined"
      ? ""
      : (window.localStorage.getItem(ADMIN_TOKEN_KEY) ?? ""),
  );

  // Form states
  const [product, setProduct] = useState("Spinach");
  const [farmOrigin, setFarmOrigin] = useState("Organic Hills Farm, Lonavla");
  const [harvestDate, setHarvestDate] = useState("2026-07-01");
  const [batchCode, setBatchCode] = useState("SPN-2026-07-01-09");
  const [quantity, setQuantity] = useState("10");

  // Output states
  const [loading, setLoading] = useState(false);
  const [activeBarcode, setActiveBarcode] = useState<BarcodeCrate | null>(null);
  const [intakeLoading, setIntakeLoading] = useState(false);
  const [inventoryList, setInventoryList] = useState<StockItem[]>([]);
  const [batchHistory, setBatchHistory] = useState<SupplierBatch[]>([]);

  // Fetch list of products in catalog to verify matching names
  const loadInventory = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/ops/inventory`, {
        headers: { "x-admin-token": token },
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        setInventoryList(data.items || []);
      }
    } catch {
      // Ignored
    }
  }, [token]);

  // Traceability history: every crate logged via "Log Crate & Generate
  // Barcode" is durable (farm origin, harvest date, batch code, for FSSAI
  // Rule 14), but until this existed nothing ever displayed it back.
  const loadBatchHistory = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/ops/supplier/batches?limit=25`, {
        headers: { "x-admin-token": token },
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        setBatchHistory(data.batches || []);
      }
    } catch {
      // Ignored
    }
  }, [token]);

  useEffect(() => {
    void loadInventory();
    void loadBatchHistory();
  }, [loadInventory, loadBatchHistory]);

  // Handle Vendor Form Submit
  const handleGenerateBarcode = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!product || !farmOrigin || !harvestDate || !batchCode || !quantity) {
      toast.error("Traceability Error: All audit-trail fields are mandatory!");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/ops/supplier/deliver`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-token": token,
        },
        credentials: "include",
        body: JSON.stringify({
          product,
          farmOrigin,
          harvestDate,
          batchCode,
          quantity: parseFloat(quantity),
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to log delivery batch");
      }

      const data = await res.json();
      setActiveBarcode(data);
      toast.success("Delivery batch logged. Scannable crate barcode generated!");
      void loadBatchHistory();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  // Handle Receiving Clerk Intake
  const handleIntakeCrate = async () => {
    if (!activeBarcode) return;
    setIntakeLoading(true);

    try {
      const res = await fetch(`${API_BASE}/ops/supplier/intake`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-token": token,
        },
        credentials: "include",
        body: JSON.stringify({
          barcodeToken: activeBarcode.barcodeToken,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Intake failed");
      }

      toast.success(`Crate verified. ${activeBarcode.quantity}kg of ${activeBarcode.product} added to kitchen stock!`);
      setActiveBarcode(null);
      void loadInventory();
      void loadBatchHistory();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setIntakeLoading(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
      <div className="flex items-center justify-between border-b border-white/[0.08] pb-4">
        <div>
          <h1 className="text-2xl font-serif text-white flex items-center gap-2">
            <ClipboardList className="w-6 h-6 text-nn-primary" />
            Supplier Crate Sourcing Portal
          </h1>
          <p className="text-xs text-nn-on-surface-variant mt-1">
            Supplier-side tracking panel. Mandatory harvest tracking for ISO-certified audit compliance.
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
          <Button size="sm" variant="outline" onClick={loadInventory} className="h-9">
            Sync Inventory
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Left Side: Supplier Delivery Form */}
        <Card className="bg-nn-surface border-white/[0.08]">
          <CardHeader className="border-b border-white/[0.04] py-3 px-4">
            <CardTitle className="text-sm font-semibold text-white flex items-center gap-2">
              <PackagePlus className="w-4 h-4 text-nn-primary" />
              New Delivery Batch Intake
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-4">
            <form onSubmit={handleGenerateBarcode} className="space-y-4">
              <div>
                <label className="text-[10px] uppercase tracking-wider text-nn-on-surface-variant block mb-1">
                  Product Name (must match inventory item)
                </label>
                <select
                  value={product}
                  onChange={(e) => setProduct(e.target.value)}
                  className="w-full rounded-md border border-white/[0.08] bg-nn-bg text-white px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-nn-primary"
                >
                  <option value="Spinach">Spinach</option>
                  <option value="Cucumber">Cucumber</option>
                  <option value="Lettuce">Lettuce</option>
                  <option value="Broccoli">Broccoli</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] uppercase tracking-wider text-nn-on-surface-variant block mb-1">
                  Farm Origin (Traceability Source)
                </label>
                <Input
                  type="text"
                  placeholder="e.g. Organic Hills Farm, Lonavla"
                  value={farmOrigin}
                  onChange={(e) => setFarmOrigin(e.target.value)}
                  className="bg-nn-bg border-white/[0.08] text-white text-xs h-9"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] uppercase tracking-wider text-nn-on-surface-variant block mb-1">
                    Harvest Date
                  </label>
                  <Input
                    type="date"
                    value={harvestDate}
                    onChange={(e) => setHarvestDate(e.target.value)}
                    className="bg-nn-bg border-white/[0.08] text-white text-xs h-9"
                  />
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-wider text-nn-on-surface-variant block mb-1">
                    Batch Code
                  </label>
                  <Input
                    type="text"
                    placeholder="e.g. SPN-260701-09"
                    value={batchCode}
                    onChange={(e) => setBatchCode(e.target.value)}
                    className="bg-nn-bg border-white/[0.08] text-white text-xs h-9"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] uppercase tracking-wider text-nn-on-surface-variant block mb-1">
                  Delivery Quantity (kg)
                </label>
                <Input
                  type="number"
                  placeholder="e.g. 20"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  className="bg-nn-bg border-white/[0.08] text-white text-xs h-9"
                />
              </div>

              <Button
                type="submit"
                className="w-full h-9 bg-nn-primary text-action-text hover:bg-nn-primary/90 font-bold uppercase tracking-wider text-xs"
                disabled={loading}
              >
                {loading ? "Logging Batch..." : "Log Crate & Generate Barcode"}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Right Side: Generated Barcode & Clerk Verification */}
        <div className="space-y-6">
          {activeBarcode ? (
            <Card className="bg-nn-surface border-clinical-sage border-2">
              <CardHeader className="bg-clinical-sage/5 border-b border-clinical-sage/20 py-3 px-4 flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-semibold text-white flex items-center gap-1.5">
                  <Barcode className="w-4 h-4 text-clinical-sage" />
                  Active Physical Crate Barcode
                </CardTitle>
                <Badge variant="outline" className="border-clinical-sage/30 text-clinical-sage text-[9px] uppercase">
                  Logged
                </Badge>
              </CardHeader>
              <CardContent className="p-5 space-y-4">
                <div className="flex flex-col items-center gap-2 p-4 bg-white rounded-lg border-2 border-dashed border-clinical-sage">
                  {/* Persisted crate barcode token. No QR renderer is bundled,
                      so we show the real token clerks type/scan rather than a
                      decorative code that encodes nothing. */}
                  <span className="text-[9px] uppercase tracking-wider text-nn-bg/60 font-semibold">
                    Scannable Crate Barcode Token
                  </span>
                  <span className="text-sm font-mono text-nn-bg font-bold tracking-widest break-all text-center select-all px-2">
                    {activeBarcode.barcodeToken}
                  </span>
                  <span className="text-[9px] text-nn-bg/50">
                    Enter this token at the receiving scanner to verify intake.
                  </span>
                </div>

                <div className="text-[11px] text-nn-on-surface-variant leading-relaxed space-y-1 bg-nn-bg/30 p-3 rounded">
                  <div>
                    <span className="font-semibold text-white">Product:</span> {activeBarcode.product}
                  </div>
                  <div>
                    <span className="font-semibold text-white">Origin:</span> {activeBarcode.farmOrigin}
                  </div>
                  <div>
                    <span className="font-semibold text-white">Harvest Date:</span> {activeBarcode.harvestDate}
                  </div>
                  <div>
                    <span className="font-semibold text-white">Batch Code:</span> {activeBarcode.batchCode}
                  </div>
                  <div>
                    <span className="font-semibold text-white">Quantity:</span> {activeBarcode.quantity} kg
                  </div>
                </div>

                <div className="p-3 bg-clinical-sage/10 border border-clinical-sage/20 rounded text-[10px] text-clinical-sage leading-normal">
                  <strong className="text-white">Audit-Trail Verified:</strong> Crate complies with strict traceability requirements. Click below to simulate scanner intake.
                </div>

                <Button
                  onClick={handleIntakeCrate}
                  className="w-full h-10 bg-clinical-sage text-white hover:bg-clinical-sage/90 font-bold uppercase tracking-wider text-xs"
                  disabled={intakeLoading}
                >
                  {intakeLoading ? "Processing Intake..." : "Verify & Intake Crate"}
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-dashed border-white/[0.08] bg-nn-surface/50">
              <CardContent className="p-12 text-center text-nn-on-surface-variant flex flex-col items-center gap-2">
                <Barcode className="w-10 h-10 text-nn-outline" />
                <p className="text-xs">Awaiting delivery batch entry from the supplier portal.</p>
              </CardContent>
            </Card>
          )}

          {/* Active Inventory Check panel */}
          {inventoryList.length > 0 && (
            <Card className="bg-nn-surface border-white/[0.08]">
              <CardHeader className="py-3 px-4 border-b border-white/[0.04]">
                <CardTitle className="text-xs font-semibold uppercase tracking-wider text-nn-on-surface-variant">
                  Active Stock Level Check
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                <div className="max-h-40 overflow-y-auto space-y-2 pr-1 text-xs">
                  {inventoryList
                    .filter((item) => ["spinach", "cucumber", "lettuce", "broccoli"].some(n => item.product.toLowerCase().includes(n)))
                    .map((item) => (
                      <div key={item.id} className="flex justify-between items-center py-1 border-b border-white/[0.024] last:border-b-0">
                        <span className="text-white font-medium">{item.product}</span>
                        <span className="text-nn-on-surface-variant font-mono text-[10px]">{item.buyingQty || "0 kg"}</span>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Traceability history: every crate ever logged, farm origin
              through intake status. Read-only audit view over the same
              records the form above writes. */}
          <Card className="bg-nn-surface border-white/[0.08]">
            <CardHeader className="py-3 px-4 border-b border-white/[0.04]">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-nn-on-surface-variant">
                Recent Deliveries (Traceability Log)
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              {batchHistory.length === 0 ? (
                <p className="text-xs text-nn-on-surface-variant">
                  No delivery batches logged yet.
                </p>
              ) : (
                <div className="max-h-64 overflow-y-auto space-y-2 pr-1 text-xs">
                  {batchHistory.map((b) => (
                    <div
                      key={b.id}
                      className="p-2 rounded border border-white/[0.024] space-y-0.5"
                    >
                      <div className="flex justify-between items-center">
                        <span className="text-white font-medium">
                          {b.product} — {b.quantity}kg
                        </span>
                        <Badge
                          variant="outline"
                          className={`text-[9px] uppercase ${
                            b.status === "received"
                              ? "border-clinical-sage/30 text-clinical-sage"
                              : "border-amber-500/30 text-amber-400"
                          }`}
                        >
                          {b.status}
                        </Badge>
                      </div>
                      <div className="text-nn-on-surface-variant text-[10px]">
                        {b.farmOrigin} · Harvested {b.harvestDate}
                      </div>
                      <div className="text-nn-on-surface-variant font-mono text-[10px]">
                        {b.batchCode}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
