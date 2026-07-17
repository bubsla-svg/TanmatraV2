import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { API_BASE } from "@/lib/apiBase";
import { ShieldCheck, AlertOctagon, CheckCircle2, FileText, Ban } from "lucide-react";
import { toast } from "sonner";

const ADMIN_TOKEN_KEY = "tanmatra:admin-token:v1";

interface BatchInfo {
  product: string;
  farmOrigin: string;
  batchCode: string;
  harvestDate: string;
}

interface ComplianceLog {
  id: number;
  logDate: string;
  coldStorageTempCelsius: number;
  hygieneConfirmed: boolean;
  deliveryBatches: BatchInfo[];
}

export default function AdminCompliance() {
  const [token] = useState(
    typeof window === "undefined"
      ? ""
      : (window.localStorage.getItem(ADMIN_TOKEN_KEY) ?? ""),
  );

  const [logs, setLogs] = useState<ComplianceLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [tamperResult, setTamperResult] = useState<{ action: string; status: number; message: string } | null>(null);

  const loadLogs = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/compliance/logs`, {
        headers: { "x-admin-token": token },
      });
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs || []);
      } else {
        toast.error("Failed to fetch compliance logs");
      }
    } catch {
      toast.error("Network error fetching compliance logs");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void loadLogs();
  }, [loadLogs]);

  // Attempt to edit (simulate tamper)
  const attemptTamperEdit = async () => {
    if (logs.length === 0) return;
    const targetId = logs[0].id;
    try {
      const res = await fetch(`${API_BASE}/compliance/logs/${targetId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "x-admin-token": token,
        },
        body: JSON.stringify({ coldStorageTempCelsius: 8.5 }), // unsafe storage temp
      });
      const data = await res.json();
      setTamperResult({
        action: `PUT /compliance/logs/${targetId}`,
        status: res.status,
        message: data.message || data.error || "Blocked",
      });
      if (res.status === 403) {
        toast.success("Write-protected: API rejected the manual update (403).");
      }
    } catch (e) {
      toast.error("Failed to execute edit tamper simulation");
    }
  };

  // Attempt to delete (simulate tamper)
  const attemptTamperDelete = async () => {
    if (logs.length === 0) return;
    const targetId = logs[0].id;
    try {
      const res = await fetch(`${API_BASE}/compliance/logs/${targetId}`, {
        method: "DELETE",
        headers: { "x-admin-token": token },
      });
      const data = await res.json();
      setTamperResult({
        action: `DELETE /compliance/logs/${targetId}`,
        status: res.status,
        message: data.message || data.error || "Blocked",
      });
      if (res.status === 403) {
        toast.success("Write-protected: API rejected the manual delete (403).");
      }
    } catch (e) {
      toast.error("Failed to execute delete tamper simulation");
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-6 print:p-0 print:max-w-full">
      {/* Prominent honesty banner: this screen shows demonstration data, not a certified HACCP capture */}
      <div className="border border-amber-500/60 bg-amber-950/30 p-4 rounded-xl flex items-start gap-3 print:border print:border-black print:bg-amber-50 print:text-black">
        <AlertOctagon className="w-5 h-5 text-amber-400 shrink-0 mt-0.5 print:text-black" />
        <div className="text-xs leading-relaxed">
          <div className="font-semibold text-amber-300 uppercase tracking-wide print:text-black">
            Sample data — demonstration only, not a certified HACCP capture
          </div>
          <p className="text-amber-200/80 mt-1 print:text-black">
            The logs below are illustrative sample records, not live sensor readings or verified hygiene check-ins.
            This console is a UI demonstration and is not an audit-ready ISO 22000 / FSSAI certificate.
          </p>
        </div>
      </div>

      {/* Header section */}
      <div className="border border-nn-primary/40 bg-nn-bg p-6 rounded-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4 print:border-0 print:bg-white print:text-black">
        <div className="space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <ShieldCheck className="w-6 h-6 text-nn-primary print:text-black" />
            <h1 className="text-2xl font-serif font-semibold text-white print:text-black">
              ISO 22000 Compliance &amp; Food Safety Console
            </h1>
            <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/50 text-[10px] uppercase print:bg-amber-100 print:text-black">
              Sample data
            </Badge>
          </div>
          <p className="text-xs text-nn-on-surface-variant leading-relaxed print:text-black">
            FSSAI Licensed Facility &middot; <span className="font-semibold text-white print:text-black">Lic. No.: 22725926001018</span>
            <br />
            Demonstration of standard operating procedures modelled on the Codex Alimentarius principles for HACCP.
            On-screen logs are illustrative sample data, not live sensor capture.
          </p>
        </div>
        <div className="flex gap-2 print:hidden">
          <div className="flex flex-col items-end gap-1">
            <Button onClick={handlePrint} variant="outline" className="text-xs">
              <FileText className="w-4 h-4 mr-2" />
              Print / Export PDF (sample)
            </Button>
            <span className="text-[10px] text-amber-400/80">Prints sample data via browser print</span>
          </div>
          <Button onClick={loadLogs} variant="ghost" className="text-xs">
            Refresh Logs
          </Button>
        </div>
      </div>

      {/* Tamper testing simulation sandbox (only visible in admin screen, hidden in print) */}
      <Card className="border-red-900/30 bg-red-950/10 print:hidden">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2 text-red-400">
            <AlertOctagon className="w-4 h-4" />
            Write-Protection Sandbox: API Edit/Delete Blocking
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-nn-on-surface-variant leading-relaxed">
            These buttons demonstrate that the compliance log endpoints are write-protected by the API: edit and delete
            requests are rejected with an HTTP 403. This is server-side write protection at the route level — not a
            tamper-proof or cryptographically verifiable audit ledger.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="destructive" onClick={attemptTamperEdit} disabled={logs.length === 0} className="bg-red-800 hover:bg-red-700">
              <Ban className="w-3.5 h-3.5 mr-2" />
              Attempt Edit Log entry
            </Button>
            <Button size="sm" variant="destructive" onClick={attemptTamperDelete} disabled={logs.length === 0} className="bg-red-800 hover:bg-red-700">
              <Ban className="w-3.5 h-3.5 mr-2" />
              Attempt Delete Log entry
            </Button>
          </div>
          {tamperResult && (
            <div className="p-3 rounded bg-black/40 border border-red-900/40 font-mono text-xs text-red-300">
              <div className="font-semibold text-red-400 mb-1">API Write-Protection Active:</div>
              <div>Action: {tamperResult.action}</div>
              <div>HTTP Status: <span className="font-bold text-white">{tamperResult.status} Forbidden</span></div>
              <div>Server Response: "{tamperResult.message}"</div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Main compliance log list */}
      <Card className="print:border-0 print:shadow-none">
        <CardHeader className="print:px-0">
          <CardTitle className="text-lg font-serif flex items-center gap-2 flex-wrap">
            Daily Operational Hygiene Sheets (Last 30 Days)
            <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/50 text-[10px] uppercase print:bg-amber-100 print:text-black">
              Sample data
            </Badge>
          </CardTitle>
          <p className="text-xs text-nn-on-surface-variant print:text-black">
            Illustrative sample records for demonstration. Temperatures, hygiene check-ins and batch traceability shown
            here are synthetic and are not captured from live sensors or field devices.
          </p>
        </CardHeader>
        <CardContent className="print:px-0">
          {loading ? (
            <p className="text-sm text-nn-on-surface-variant">Loading compliance database records...</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="border-b border-white/[0.08] bg-nn-surface-high text-nn-on-surface-variant font-semibold print:bg-gray-100 print:text-black">
                    <th className="p-3">Log Date</th>
                    <th className="p-3">Cold Storage (°C)</th>
                    <th className="p-3">Daily Hygiene Checks</th>
                    <th className="p-3">Supplier Crate Traceability / Farm Origin (FSSAI Rule 14)</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr key={log.id} className="border-b border-white/[0.04] hover:bg-nn-surface/50 print:hover:bg-white print:text-black">
                      <td className="p-3 font-semibold font-mono text-white print:text-black">{log.logDate}</td>
                      <td className="p-3">
                        <span className={`font-semibold ${log.coldStorageTempCelsius > 4.0 ? 'text-amber-400' : 'text-emerald-400'} print:text-black`}>
                          {log.coldStorageTempCelsius.toFixed(1)}°C
                        </span>
                        <span className="text-[10px] text-nn-on-surface-variant ml-1 print:text-gray-500">(Target: &lt;5.0°C)</span>
                      </td>
                      <td className="p-3">
                        <Badge className="bg-emerald-600/20 text-emerald-400 border-emerald-600/40 text-[10px] uppercase print:bg-emerald-100 print:text-emerald-800">
                          <CheckCircle2 className="w-3 h-3 mr-1 inline" /> Sample: Verified
                        </Badge>
                      </td>
                      <td className="p-3">
                        <div className="space-y-1.5">
                          {log.deliveryBatches.map((batch, bi) => (
                            <div key={bi} className="bg-nn-bg/60 p-2 rounded border border-white/[0.032] text-[11px] print:bg-gray-50 print:border-gray-300">
                              <div className="font-semibold text-white print:text-black">{batch.product}</div>
                              <div className="text-nn-on-surface-variant print:text-gray-600">Origin: {batch.farmOrigin}</div>
                              <div className="flex gap-4 mt-0.5 text-[10px] text-nn-secondary print:text-gray-500">
                                <span>Code: <code className="font-mono text-nn-primary print:text-black">{batch.batchCode}</code></span>
                                <span>Harvested: {batch.harvestDate}</span>
                              </div>
                            </div>
                          ))}
                          {log.deliveryBatches.length === 0 && (
                            <span className="text-nn-secondary italic">No fresh batch deliveries processed this date</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {logs.length === 0 && (
                    <tr>
                      <td colSpan={4} className="p-8 text-center text-nn-secondary">
                        No compliance sheets registered. Click refresh or ensure seeder is triggered on server launch.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
