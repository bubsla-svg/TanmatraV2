import React, { useEffect, useState } from "react";
import { Link } from "react-router";
import { z } from "zod/v4";
import { CaretLeft, CaretRight, Warning } from "@phosphor-icons/react";

interface AuditLog {
  id: number;
  actorId: string;
  actorRole: string;
  action: string;
  resourceType: string | null;
  resourceId: string | null;
  ipAddress: string | null;
  meta: string | null;
  createdAt: string;
}

function DiffViewer({ before, after }: { before: any; after: any }) {
  const allKeys = Array.from(new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})]));
  
  return (
    <div className="border border-stone-800 rounded-md overflow-hidden text-sm">
      <table className="w-full text-left">
        <thead className="bg-stone-900 text-stone-400">
          <tr>
            <th className="px-3 py-2 font-medium w-1/3">Field</th>
            <th className="px-3 py-2 font-medium w-1/3">Before</th>
            <th className="px-3 py-2 font-medium w-1/3">After</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-stone-800 bg-black">
          {allKeys.map(key => {
            const bVal = JSON.stringify(before?.[key] ?? null);
            const aVal = JSON.stringify(after?.[key] ?? null);
            const changed = bVal !== aVal;
            
            return (
              <tr key={key} className={changed ? "bg-stone-900/50" : ""}>
                <td className="px-3 py-2 font-mono text-stone-300">{key}</td>
                <td className={`px-3 py-2 font-mono ${changed ? "text-red-400" : "text-stone-500"}`}>{bVal}</td>
                <td className={`px-3 py-2 font-mono ${changed ? "text-green-400" : "text-stone-500"}`}>{aVal}</td>
              </tr>
            );
          })}
          {allKeys.length === 0 && (
            <tr>
              <td colSpan={3} className="px-3 py-4 text-center text-stone-500 italic">No state changes recorded</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export default function AdminAudit() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/admin/audit?limit=100");
        if (!res.ok) throw new Error("Failed to load audit logs");
        const data = await res.json();
        setLogs(data.logs);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return (
    <div className="p-6 max-w-6xl mx-auto text-stone-200">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white mb-1">
            System Audit Trail
          </h1>
          <p className="text-stone-400 text-sm">
            Immutable log of administrative and clinical actions
          </p>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-950/30 border border-red-900/50 rounded-lg flex items-start gap-3">
          <Warning className="w-5 h-5 text-red-500 shrink-0 mt-0.5" weight="bold" />
          <p className="text-red-200 text-sm">{error}</p>
        </div>
      )}

      {loading ? (
        <div className="animate-pulse space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-24 bg-stone-900 rounded-lg border border-stone-800" />
          ))}
        </div>
      ) : logs.length === 0 ? (
        <div className="text-center py-12 border border-stone-800 border-dashed rounded-lg">
          <p className="text-stone-500">No audit logs found</p>
        </div>
      ) : (
        <div className="space-y-4">
          {logs.map((log) => {
            const meta = log.meta ? JSON.parse(log.meta) : null;
            return (
              <div key={log.id} className="bg-black border border-stone-800 rounded-lg overflow-hidden">
                <div className="px-4 py-3 bg-stone-900/40 border-b border-stone-800 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-xs text-stone-400 bg-stone-900 px-2 py-1 rounded">
                      {new Date(log.createdAt).toLocaleString()}
                    </span>
                    <span className="font-medium text-stone-200">{log.action}</span>
                    {log.resourceType && log.resourceId && (
                      <span className="text-xs text-stone-500">
                        on <span className="text-stone-300">{log.resourceType}:{log.resourceId}</span>
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-stone-500 font-mono">
                    {log.actorRole} {log.actorId}
                  </div>
                </div>
                
                <div className="p-4">
                  {meta?.reason && (
                    <div className="mb-4 text-sm text-stone-300">
                      <span className="text-stone-500 mr-2">Reason:</span>
                      {meta.reason}
                    </div>
                  )}
                  
                  {(meta?.before || meta?.after) ? (
                    <DiffViewer before={meta.before} after={meta.after} />
                  ) : (
                    <div className="text-sm text-stone-500 italic">No diff available</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
