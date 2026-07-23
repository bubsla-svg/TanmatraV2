"use client";
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
  if (addresses.length === 0) {
    return <p className="text-sm text-ink-muted">No saved addresses yet.</p>;
  }
  return (
    <ul className="flex flex-col gap-3">
      {addresses.map((a) => {
        const busy = busyId === a.id;
        return (
          <li key={a.id} className="rounded-xl border border-line bg-surface p-4">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-ink">{a.label}</span>
              <span className="rounded-full border border-line px-2 py-0.5 text-[11px] text-ink-muted">{a.type}</span>
              {a.isDefault && (
                <span className="rounded-full bg-sage-soft px-2 py-0.5 text-[11px] font-medium text-sage-text">Default</span>
              )}
            </div>
            <p className="mt-1 text-sm text-ink-muted">
              {[a.line1, a.line2].filter(Boolean).join(", ")}, {a.city} {a.pincode}
            </p>
            <p className="tabular text-xs text-ink-faint">{a.phone}</p>
            <div className="mt-3 flex items-center gap-4 text-sm font-medium">
              <button type="button" disabled={busy} onClick={() => onEdit(a)} className="-m-1 p-1 text-gold-text hover:underline disabled:opacity-40">Edit</button>
              {!a.isDefault && (
                <button type="button" disabled={busy} onClick={() => onSetDefault(a.id)} className="-m-1 p-1 text-ink-muted hover:underline disabled:opacity-40">Set default</button>
              )}
              <button type="button" disabled={busy} onClick={() => onDelete(a.id)} className="-m-1 p-1 text-[var(--danger)] hover:underline disabled:opacity-40">Delete</button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
