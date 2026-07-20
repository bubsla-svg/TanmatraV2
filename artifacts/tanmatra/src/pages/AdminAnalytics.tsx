import { lazy, Suspense, useEffect, useMemo, useState, type ReactElement } from "react";
import { API_BASE } from "@/lib/apiBase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const ADMIN_TOKEN_KEY = "tanmatra:admin-token:v1";

// recharts is ~390 KB minified. Loading it via dynamic import() keeps it in an
// async chunk that is fetched only when a chart actually renders, instead of
// riding along in the synchronous route (and, via shared-chunk colocation, the
// first-load) graph. Destructuring inside .then() (rather than keeping the whole
// namespace) lets rollup tree-shake the unused recharts exports.
type RechartsBits = Pick<
  typeof import("recharts"),
  "Bar" | "BarChart" | "CartesianGrid" | "Line" | "LineChart" | "ResponsiveContainer" | "Tooltip" | "XAxis" | "YAxis"
>;

const RechartsHost = lazy(() =>
  import("recharts").then(
    ({ Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis }) => ({
      default: ({ render }: { render: (r: RechartsBits) => ReactElement }) =>
        render({ Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis }),
    })
  )
);

function ChartSkeleton() {
  return <div className="h-full w-full rounded-md bg-muted/40 animate-pulse" aria-hidden="true" />;
}

type ChartKind = "bar" | "line" | "area" | "table";
interface ChartSpec {
  kind: ChartKind;
  xKey?: string;
  yKey?: string;
  title?: string;
}
interface AskResult {
  question: string;
  sql: string;
  chartSpec: ChartSpec;
  rationale: string;
  result: { rows: Record<string, unknown>[]; rowCount: number; truncated: boolean; durationMs: number };
}

interface SavedQuery {
  id: number;
  question: string;
  sql: string;
  chartSpec: ChartSpec | null;
  rationale: string | null;
  rowCount: number;
  saved: number;
  createdAt: string;
}

interface WbrReport {
  id: number;
  weekStart: string;
  weekEnd: string;
  kpis: {
    orders: number;
    ordersPrev: number;
    revenuePaise: number;
    revenuePaisePrev: number;
    activeCustomers: number;
    activeCustomersPrev: number;
    avgOrderPaise: number;
    topDishes: Array<{ name: string; units: number }>;
    anomaliesFired: number;
    netMarginPct?: number;
  };
  chartSpec: {
    revenueByDay: Array<{ day: string; revenuePaise: number }>;
    ordersByDay: Array<{ day: string; orders: number }>;
  } | null;
  commentary: string;
  modelId: string | null;
  createdAt: string;
}

interface VocTheme {
  id: number;
  weekStart: string;
  weekEnd: string;
  theme: string;
  sentiment: "positive" | "negative" | "mixed";
  mentionCount: number;
  exampleQuotes: Array<{ source: string; body: string }>;
  summary: string;
  createdAt: string;
}

interface SafeTable {
  name: string;
  description: string;
  columns: Array<{ name: string; type: string; description?: string }>;
}

interface FunnelStep {
  label: string;
  events: string[];
  count: number;
  sessions: number;
  users: number;
  dropOffPct: number | null;
  conversionPct: number | null;
}

interface Funnel {
  id: string;
  name: string;
  kpi: string;
  steps: FunnelStep[];
  overallConversionPct: number | null;
}

function getToken(): string {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(ADMIN_TOKEN_KEY) ?? "";
}

async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  const token = getToken();
  if (token) headers.set("x-admin-token", token);
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const res = await fetch(`${API_BASE}${path}`, { ...init, headers, credentials: "include" });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(body || `HTTP ${res.status}`);
  }
  return (await res.json()) as T;
}

function rupees(paise: number): string {
  return `₹${(paise / 100).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

function deltaLabel(curr: number, prev: number): { text: string; positive: boolean } {
  if (prev <= 0) return { text: curr > 0 ? "new" : "0%", positive: curr > 0 };
  const d = ((curr - prev) / prev) * 100;
  return { text: `${d >= 0 ? "+" : ""}${d.toFixed(1)}%`, positive: d >= 0 };
}

function SchemaPanel({ tables }: { tables: SafeTable[] }) {
  return (
    <ScrollArea className="max-h-[280px] text-xs border rounded p-3 bg-muted/20">
      {tables.map((t) => (
        <div key={t.name} className="mb-2">
          <div className="font-medium">{t.name}</div>
          <div className="text-muted-foreground italic">{t.description}</div>
          <div className="pl-3">
            {t.columns.map((c) => (
              <div key={c.name}>
                <span className="font-mono">{c.name}</span>{" "}
                <span className="text-muted-foreground">{c.type}</span>
                {c.description ? <span className="text-muted-foreground"> — {c.description}</span> : null}
              </div>
            ))}
          </div>
        </div>
      ))}
    </ScrollArea>
  );
}

function ResultChart({ chartSpec, rows }: { chartSpec: ChartSpec; rows: Record<string, unknown>[] }) {
  if (!rows.length) return <p className="text-sm text-muted-foreground">No rows.</p>;
  const xKey = chartSpec.xKey ?? Object.keys(rows[0] ?? {})[0] ?? "";
  const yKey = chartSpec.yKey ?? Object.keys(rows[0] ?? {})[1] ?? "";
  if (chartSpec.kind === "table" || !xKey || !yKey) {
    const cols = Object.keys(rows[0] ?? {});
    return (
      <ScrollArea className="max-h-[320px] border rounded">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-muted">
            <tr>{cols.map((c) => <th key={c} className="text-left p-2">{c}</th>)}</tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-t">
                {cols.map((c) => <td key={c} className="p-2">{String(r[c] ?? "")}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </ScrollArea>
    );
  }
  const data = rows.map((r) => ({ ...r, [yKey]: Number(r[yKey] ?? 0) }));
  return (
    <div className="h-72">
      <Suspense fallback={<ChartSkeleton />}>
        <RechartsHost
          render={(R) => (
            <R.ResponsiveContainer width="100%" height="100%">
              {chartSpec.kind === "line" || chartSpec.kind === "area" ? (
                <R.LineChart data={data}>
                  <R.CartesianGrid strokeDasharray="3 3" />
                  <R.XAxis dataKey={xKey} tick={{ fontSize: 11 }} />
                  <R.YAxis tick={{ fontSize: 11 }} />
                  <R.Tooltip />
                  <R.Line type="monotone" dataKey={yKey} stroke="var(--color-success)" strokeWidth={2} dot={false} />
                </R.LineChart>
              ) : (
                <R.BarChart data={data}>
                  <R.CartesianGrid strokeDasharray="3 3" />
                  <R.XAxis dataKey={xKey} tick={{ fontSize: 11 }} />
                  <R.YAxis tick={{ fontSize: 11 }} />
                  <R.Tooltip />
                  <R.Bar dataKey={yKey} fill="var(--color-nn-tertiary)" />
                </R.BarChart>
              )}
            </R.ResponsiveContainer>
          )}
        />
      </Suspense>
    </div>
  );
}

function AskTab() {
  const [tables, setTables] = useState<SafeTable[]>([]);
  const [question, setQuestion] = useState("Top 5 dishes by units last 14 days");
  const [sql, setSql] = useState("");
  const [chartSpec, setChartSpec] = useState<ChartSpec>({ kind: "table" });
  const [rationale, setRationale] = useState("");
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [history, setHistory] = useState<SavedQuery[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const reload = () => {
    void api<{ tables: SafeTable[] }>("/analytics/schema").then((r) => setTables(r.tables)).catch(() => undefined);
    void api<{ queries: SavedQuery[] }>("/analytics/queries").then((r) => setHistory(r.queries)).catch(() => undefined);
  };

  useEffect(() => { reload(); }, []);

  const ask = async () => {
    setBusy(true); setErr(null);
    try {
      const out = await api<AskResult>("/analytics/ask", {
        method: "POST", body: JSON.stringify({ question }),
      });
      setSql(out.sql); setChartSpec(out.chartSpec); setRationale(out.rationale); setRows(out.result.rows);
      reload();
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  };

  const runEdited = async () => {
    setBusy(true); setErr(null);
    try {
      const out = await api<{ result: { rows: Record<string, unknown>[] } }>("/analytics/sql", {
        method: "POST", body: JSON.stringify({ sql, question, chartSpec }),
      });
      setRows(out.result.rows); reload();
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  };

  return (
    <div className="grid lg:grid-cols-3 gap-4">
      <div className="lg:col-span-2 space-y-4">
        <Card>
          <CardHeader><CardTitle>Ask the data</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <Input value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="e.g. revenue by day for the last 30 days" />
              <Button onClick={ask} disabled={busy || !question.trim()}>{busy ? "Thinking…" : "Ask"}</Button>
            </div>
            {rationale && <p className="text-xs text-muted-foreground">{rationale}</p>}
            <Textarea value={sql} onChange={(e) => setSql(e.target.value)} rows={6} className="font-mono text-xs" placeholder="Generated SQL appears here. You can edit and re-run." />
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" onClick={runEdited} disabled={busy || !sql.trim()}>Run edited SQL</Button>
              <span className="text-xs text-muted-foreground">{rows.length} rows</span>
            </div>
            {err && <p className="text-xs text-red-600">{err}</p>}
            <ResultChart chartSpec={chartSpec} rows={rows} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Recent questions</CardTitle></CardHeader>
          <CardContent>
            <ScrollArea className="max-h-[260px]">
              <div className="space-y-2 text-xs">
                {history.map((h) => (
                  <button key={h.id} className="w-full text-left border rounded p-2 hover:bg-muted/50"
                    onClick={() => { setQuestion(h.question); setSql(h.sql); if (h.chartSpec) setChartSpec(h.chartSpec); }}>
                    <div className="font-medium">{h.question}</div>
                    <div className="text-muted-foreground">{new Date(h.createdAt).toLocaleString()} · {h.rowCount} rows</div>
                  </button>
                ))}
                {history.length === 0 && <p className="text-muted-foreground">No queries yet.</p>}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader><CardTitle>Safe schema</CardTitle></CardHeader>
        <CardContent><SchemaPanel tables={tables} /></CardContent>
      </Card>
    </div>
  );
}

function WbrTab() {
  const [reports, setReports] = useState<WbrReport[]>([]);
  const [active, setActive] = useState<WbrReport | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [fuelIncrease, setFuelIncrease] = useState(10);
  const [simulatedMargin, setSimulatedMargin] = useState<number | null>(null);
  const [simulating, setSimulating] = useState(false);

  const runSimulation = async () => {
    setSimulating(true);
    try {
      const res = await api<{ netMarginPct: number; thresholdAlert: boolean }>("/analytics/wbr/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fuelIncreasePct: fuelIncrease }),
      });
      setSimulatedMargin(res.netMarginPct);
    } catch {
      // Ignored
    } finally {
      setSimulating(false);
    }
  };

  const load = () => {
    void api<{ reports: WbrReport[] }>("/analytics/wbr")
      .then((r) => { setReports(r.reports); if (!active && r.reports[0]) setActive(r.reports[0]); })
      .catch((e) => setErr(e instanceof Error ? e.message : String(e)));
  };
  useEffect(load, []);

  const generate = async () => {
    setBusy(true); setErr(null);
    try {
      const r = await api<{ report: WbrReport }>("/analytics/wbr/generate", { method: "POST", body: "{}" });
      setActive(r.report); load();
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  };

  const k = active?.kpis;
  const ordersDelta = k ? deltaLabel(k.orders, k.ordersPrev) : null;
  const revDelta = k ? deltaLabel(k.revenuePaise, k.revenuePaisePrev) : null;
  const custDelta = k ? deltaLabel(k.activeCustomers, k.activeCustomersPrev) : null;

  return (
    <div className="grid lg:grid-cols-3 gap-4">
      <div className="lg:col-span-2 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-lg">{active ? `Week of ${new Date(active.weekStart).toLocaleDateString()}` : "Weekly Business Review"}</h2>
          <Button onClick={generate} disabled={busy}>{busy ? "Generating…" : "Generate latest"}</Button>
        </div>
        {err && <p className="text-xs text-red-600">{err}</p>}
        {active && k && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Orders</div><div className="text-xl font-bold">{k.orders}</div><div className={`text-xs ${ordersDelta?.positive ? "text-emerald-600" : "text-red-600"}`}>{ordersDelta?.text}</div></CardContent></Card>
              <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Revenue</div><div className="text-xl font-bold">{rupees(k.revenuePaise)}</div><div className={`text-xs ${revDelta?.positive ? "text-emerald-600" : "text-red-600"}`}>{revDelta?.text}</div></CardContent></Card>
              <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Active customers</div><div className="text-xl font-bold">{k.activeCustomers}</div><div className={`text-xs ${custDelta?.positive ? "text-emerald-600" : "text-red-600"}`}>{custDelta?.text}</div></CardContent></Card>
              <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">AOV</div><div className="text-xl font-bold">{rupees(k.avgOrderPaise)}</div><div className="text-xs text-muted-foreground">{k.anomaliesFired} anomalies</div></CardContent></Card>
              <Card>
                <CardContent className="p-4">
                  <div className="text-xs text-muted-foreground">Net Margin</div>
                  <div className="text-xl font-bold">
                    {k.netMarginPct !== undefined ? `${k.netMarginPct}%` : "—"}
                  </div>
                  <div className="mt-1">
                    {k.netMarginPct !== undefined && (
                      <Badge className={k.netMarginPct < 35.0 ? "bg-red-500 text-white border-0 text-[10px]" : "bg-emerald-500 text-white border-0 text-[10px]"}>
                        {k.netMarginPct < 35.0 ? "Low (<35%)" : "Healthy"}
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card className="bg-muted/10 border-dashed">
              <CardHeader className="py-3 space-y-1">
                <CardTitle className="text-sm font-semibold">What-if margin simulator (aggregate)</CardTitle>
                <p className="text-xs text-muted-foreground font-normal">
                  Manual scenario tool. Drag the slider to model a hypothetical fuel/logistics cost increase against the
                  aggregate net margin. This is not a live ingredient-cost feed and does not reflect real vendor price
                  changes or flag specific products.
                </p>
              </CardHeader>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex-1 space-y-1">
                    <label className="text-xs text-muted-foreground block">Hypothetical Fuel/Logistics Cost Increase: <span className="font-bold text-white">{fuelIncrease}%</span></label>
                    <input
                      type="range"
                      min="0"
                      max="50"
                      value={fuelIncrease}
                      onChange={(e) => setFuelIncrease(Number(e.target.value))}
                      className="w-full h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer"
                    />
                  </div>
                  <Button size="sm" onClick={runSimulation} disabled={simulating}>
                    {simulating ? "Simulating..." : "Run scenario"}
                  </Button>
                </div>
                {simulatedMargin !== null && (
                  <div className="p-3 rounded bg-muted/20 border flex justify-between items-center text-xs">
                    <div>
                      Simulated aggregate net margin: <span className={`font-bold ${simulatedMargin < 35.0 ? 'text-red-400' : 'text-emerald-400'}`}>{simulatedMargin}%</span>
                    </div>
                    {simulatedMargin < 35.0 ? (
                      <Badge className="bg-red-500 text-white border-0 text-[10px]">Below 35% in this scenario</Badge>
                    ) : (
                      <Badge className="bg-emerald-500 text-white border-0 text-[10px]">Above 35% in this scenario</Badge>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Commentary</CardTitle></CardHeader>
              <CardContent><p className="text-sm whitespace-pre-wrap">{active.commentary}</p>
                <p className="text-xs text-muted-foreground mt-2">Model: {active.modelId ?? "—"}</p>
              </CardContent>
            </Card>
            {active.chartSpec && (
              <Card>
                <CardHeader><CardTitle>Revenue by day</CardTitle></CardHeader>
                <CardContent>
                  <div className="h-60">
                    <Suspense fallback={<ChartSkeleton />}>
                      <RechartsHost
                        render={(R) => (
                          <R.ResponsiveContainer width="100%" height="100%">
                            <R.LineChart data={active.chartSpec!.revenueByDay.map((d) => ({ day: d.day, revenue: d.revenuePaise / 100 }))}>
                              <R.CartesianGrid strokeDasharray="3 3" />
                              <R.XAxis dataKey="day" tick={{ fontSize: 11 }} />
                              <R.YAxis tick={{ fontSize: 11 }} />
                              <R.Tooltip />
                              <R.Line type="monotone" dataKey="revenue" stroke="var(--color-success)" strokeWidth={2} dot />
                            </R.LineChart>
                          </R.ResponsiveContainer>
                        )}
                      />
                    </Suspense>
                  </div>
                </CardContent>
              </Card>
            )}
            <Card>
              <CardHeader><CardTitle>Top dishes</CardTitle></CardHeader>
              <CardContent>
                <ul className="text-sm space-y-1">
                  {k.topDishes.map((d) => <li key={d.name} className="flex justify-between border-b py-1"><span>{d.name}</span><span className="font-medium">{d.units} units</span></li>)}
                  {k.topDishes.length === 0 && <li className="text-muted-foreground">No data.</li>}
                </ul>
              </CardContent>
            </Card>
          </>
        )}
      </div>
      <Card>
        <CardHeader><CardTitle>Past reviews</CardTitle></CardHeader>
        <CardContent>
          <ScrollArea className="max-h-[600px]">
            <div className="space-y-2 text-xs">
              {reports.map((r) => (
                <button key={r.id} className={`w-full text-left border rounded p-2 hover:bg-muted/50 ${active?.id === r.id ? "bg-muted" : ""}`} onClick={() => setActive(r)}>
                  <div className="font-medium">{new Date(r.weekStart).toLocaleDateString()}</div>
                  <div className="text-muted-foreground">{r.kpis.orders} orders · {rupees(r.kpis.revenuePaise)}</div>
                </button>
              ))}
              {reports.length === 0 && <p className="text-muted-foreground">No reports yet — click Generate.</p>}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}

const SENT_COLOR: Record<VocTheme["sentiment"], string> = {
  positive: "bg-emerald-500 text-white",
  negative: "bg-rose-500 text-white",
  mixed: "bg-amber-500 text-white",
};

function VocTab() {
  const [themes, setThemes] = useState<VocTheme[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = () => {
    void api<{ themes: VocTheme[] }>("/analytics/voc/themes")
      .then((r) => setThemes(r.themes))
      .catch((e) => setErr(e instanceof Error ? e.message : String(e)));
  };
  useEffect(load, []);

  const extract = async () => {
    setBusy(true); setErr(null);
    try {
      await api("/analytics/voc/extract", { method: "POST", body: "{}" });
      load();
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  };

  // Group by week and compute trend per theme across weeks.
  const weeks = useMemo(() => {
    const map = new Map<string, VocTheme[]>();
    for (const t of themes) {
      const key = new Date(t.weekStart).toISOString().slice(0, 10);
      const arr = map.get(key) ?? [];
      arr.push(t);
      map.set(key, arr);
    }
    return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [themes]);

  const trendByTheme = useMemo(() => {
    const m = new Map<string, Array<{ week: string; mentions: number }>>();
    for (const [week, list] of [...weeks].reverse()) {
      for (const t of list) {
        const arr = m.get(t.theme) ?? [];
        arr.push({ week, mentions: t.mentionCount });
        m.set(t.theme, arr);
      }
    }
    return m;
  }, [weeks]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-lg">Voice of customer</h2>
        <Button onClick={extract} disabled={busy}>{busy ? "Mining…" : "Refresh this week"}</Button>
      </div>
      {err && <p className="text-xs text-red-600">{err}</p>}
      {weeks.map(([week, list]) => (
        <Card key={week}>
          <CardHeader><CardTitle>Week of {new Date(week).toLocaleDateString()}</CardTitle></CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-3">
              {list.map((t) => {
                const trend = trendByTheme.get(t.theme) ?? [];
                return (
                  <div key={t.id} className="border rounded p-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge className={SENT_COLOR[t.sentiment]}>{t.sentiment}</Badge>
                      <span className="font-medium">{t.theme}</span>
                      <span className="ml-auto text-xs text-muted-foreground">{t.mentionCount} mentions</span>
                    </div>
                    <p className="text-sm mt-2">{t.summary}</p>
                    {t.exampleQuotes.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {t.exampleQuotes.map((q, i) => (
                          <p key={i} className="text-xs italic text-muted-foreground border-l-2 pl-2">
                            “{q.body}” <span className="not-italic">— {q.source}</span>
                          </p>
                        ))}
                      </div>
                    )}
                    {trend.length > 1 && (
                      <div className="h-16 mt-2">
                        <Suspense fallback={<ChartSkeleton />}>
                          <RechartsHost
                            render={(R) => (
                              <R.ResponsiveContainer width="100%" height="100%">
                                <R.LineChart data={trend}>
                                  <R.Line type="monotone" dataKey="mentions" stroke="var(--color-nn-tertiary)" strokeWidth={2} dot={false} />
                                </R.LineChart>
                              </R.ResponsiveContainer>
                            )}
                          />
                        </Suspense>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      ))}
      {weeks.length === 0 && <p className="text-sm text-muted-foreground">No themes yet — click Refresh to mine the past week of reviews and support chats.</p>}
    </div>
  );
}

const FUNNEL_WINDOWS = [7, 14, 30] as const;

function pctLabel(v: number | null): string {
  return v === null ? "—" : `${v}%`;
}

function FunnelsTab() {
  const [days, setDays] = useState<number>(7);
  const [funnels, setFunnels] = useState<Funnel[]>([]);
  const [since, setSince] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setBusy(true);
    setErr(null);
    api<{ days: number; since: string; funnels: Funnel[] }>(`/analytics/funnels?days=${days}`)
      .then((r) => {
        if (cancelled) return;
        setFunnels(r.funnels);
        setSince(r.since);
      })
      .catch((e) => {
        if (!cancelled) setErr(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (!cancelled) setBusy(false);
      });
    return () => {
      cancelled = true;
    };
  }, [days]);

  const hasData = funnels.some((f) => f.steps.some((s) => s.count > 0));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="font-semibold text-lg">Funnels</h2>
          <p className="text-xs text-muted-foreground">
            The 5 named funnels (§8.3), aggregated nightly from first-party events
            {since ? ` · since ${new Date(`${since}T00:00:00Z`).toLocaleDateString()}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-1">
          {FUNNEL_WINDOWS.map((w) => (
            <Button key={w} size="sm" variant={days === w ? "default" : "outline"} onClick={() => setDays(w)} disabled={busy}>
              {w}d
            </Button>
          ))}
        </div>
      </div>
      {err && <p className="text-xs text-red-600">{err}</p>}
      {!err && !busy && !hasData && (
        <p className="text-sm text-muted-foreground">
          No funnel data in this window yet. Events land in funnel_events immediately and are rolled up into
          funnel_daily by the nightly job — check back after the next rollup tick.
        </p>
      )}
      <div className="grid md:grid-cols-2 gap-4">
        {funnels.map((f) => (
          <Card key={f.id}>
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2 flex-wrap">
                <CardTitle>{f.name}</CardTitle>
                <Badge variant="outline" className="text-[10px]">{f.kpi}</Badge>
                <span className="ml-auto text-xs text-muted-foreground">
                  overall <span className="font-medium text-clinical-data">{pctLabel(f.overallConversionPct)}</span>
                </span>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {f.steps.map((s, i) => (
                <div key={s.label}>
                  {i > 0 && (
                    <div className="flex justify-end pr-1">
                      <span className={`text-[10px] ${s.dropOffPct !== null && s.dropOffPct > 0 ? "text-red-600" : "text-muted-foreground"}`}>
                        ↓ {s.dropOffPct === null ? "—" : `${s.dropOffPct}% drop`}
                      </span>
                    </div>
                  )}
                  <div className="flex items-baseline justify-between gap-2 text-xs">
                    <span className="truncate" title={s.events.join(", ")}>
                      <span className="text-muted-foreground mr-1">{i + 1}.</span>
                      {s.label}
                    </span>
                    <span className="text-clinical-data whitespace-nowrap">
                      {s.count.toLocaleString()}
                      <span className="text-muted-foreground"> · {pctLabel(s.conversionPct)}</span>
                    </span>
                  </div>
                  <div className="h-2 mt-1 rounded-full bg-muted/40 overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.max(s.count > 0 ? 2 : 0, Math.min(100, s.conversionPct ?? 0))}%`,
                        background: "var(--color-nn-tertiary)",
                      }}
                    />
                  </div>
                </div>
              ))}
              <p className="text-[10px] text-muted-foreground pt-1">
                counts = events in window · sessions/users are per-day distincts (server-truth money events carry no session)
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

export default function AdminAnalytics() {
  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Analytics</h1>
        <p className="text-sm text-muted-foreground">
          Internal AI pack: ask the warehouse in plain English, generate the weekly business review,
          and mine voice-of-customer themes. All queries run read-only against a curated safe view.
        </p>
      </div>
      <Tabs defaultValue="ask">
        <TabsList>
          <TabsTrigger value="ask">Ask the data</TabsTrigger>
          <TabsTrigger value="wbr">Weekly review</TabsTrigger>
          <TabsTrigger value="voc">Voice of customer</TabsTrigger>
          <TabsTrigger value="funnels">Funnels</TabsTrigger>
        </TabsList>
        <TabsContent value="ask"><AskTab /></TabsContent>
        <TabsContent value="wbr"><WbrTab /></TabsContent>
        <TabsContent value="voc"><VocTab /></TabsContent>
        <TabsContent value="funnels"><FunnelsTab /></TabsContent>
      </Tabs>
    </div>
  );
}
