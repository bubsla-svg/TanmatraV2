"use client";
import { useState } from "react";
// Client: presentational list of saved addresses with row actions.
import type { Address } from "@/lib/api";

/**
 * SF-04 address list. Pure presentational — the parent owns the data and the
 * mutations; this renders each row default-first (the server already orders
 * them that way) and surfaces edit / delete / set-default. The row being
 * mutated is disabled via `busyId`.
 */
export function AddressList({
  addresses,
  busyId,
  onEdit,
  onDelete,
  onSetDefault,
}: {
  addresses: Address[];
  busyId: string | null;
  onEdit: (address: Address) => void;
  onDelete: (id: string) => void;
  onSetDefault: (id: string) => void;
}) {
  // Two-tap delete: one tap used to remove an address for good, while the
  // far less destructive plan cancel asked first (2026-09-06 audit).
  const [confirmId, setConfirmId] = useState<string | null>(null);
  if (addresses.length === 0) {
    return (
      <p className="rounded-2xl bg-secondary px-4 py-3 text-xs text-ink-muted">
        No saved addresses yet. Add one above, or it will be saved the first time you check out.
      </p>
    );
  }
  return (
    <ul className="flex flex-col gap-3">
      {addresses.map((a) => {
        const busy = busyId === a.id;
        return (
          <li key={a.id} className="flex flex-col gap-1.5 rounded-2xl border border-line bg-surface p-5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-display text-lg font-semibold leading-tight text-primary">{a.label}</span>
              <span className="rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium text-ink-muted">{a.type}</span>
              {a.isDefault && (
                <span className="rounded-full bg-sage-soft px-2.5 py-0.5 text-xs font-medium text-sage-text">Default</span>
              )}
            </div>
            <p className="text-sm text-ink-muted">
              {[a.line1, a.line2].filter(Boolean).join(", ")}, {a.city} {a.pincode}
            </p>
            <p className="font-data text-xs text-ink-faint">{a.phone}</p>
            <div className="mt-1 flex items-center gap-5 border-t border-line pt-1 text-sm">
              <button type="button" disabled={busy} onClick={() => onEdit(a)} className="inline-flex min-h-11 items-center font-semibold text-primary underline-offset-4 hover:underline disabled:opacity-40">Edit</button>
              {!a.isDefault && (
                <button type="button" disabled={busy} onClick={() => onSetDefault(a.id)} className="inline-flex min-h-11 items-center font-semibold text-ink-muted underline-offset-4 hover:underline disabled:opacity-40">Set default</button>
              )}
              {confirmId === a.id ? (
                <span role="group" aria-label={`Delete ${a.label}?`} className="inline-flex items-center gap-3">
                  <span className="text-ink-muted">Delete {a.label}?</span>
                  <button type="button" disabled={busy} onClick={() => { setConfirmId(null); onDelete(a.id); }} className="inline-flex min-h-11 items-center font-semibold text-danger underline-offset-4 hover:underline disabled:opacity-40">Yes, delete</button>
                  <button type="button" onClick={() => setConfirmId(null)} className="inline-flex min-h-11 items-center font-semibold text-ink-muted underline-offset-4 hover:underline">Keep</button>
                </span>
              ) : (
                <button type="button" disabled={busy} onClick={() => setConfirmId(a.id)} className="inline-flex min-h-11 items-center font-semibold text-danger underline-offset-4 hover:underline disabled:opacity-40">Delete</button>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
