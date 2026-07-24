"use client";
// Office-lunch dish picker: qty steppers + running total vs the per-person
// budget. Server re-prices and re-enforces the budget on save (this is display).
import { useState } from "react";
import { formatPaise } from "@/lib/format";
import type { DishData } from "@workspace/menu-catalog";

export function OfficePicker({ dishes, initial, budgetPaise, busy, onSave }: {
  dishes: Pick<DishData, "id" | "name" | "price">[];
  initial: Record<number, number>;
  budgetPaise: number;
  busy: boolean;
  onSave: (items: { dishId: number; quantity: number }[]) => void;
}) {
  const [qty, setQty] = useState<Record<number, number>>(initial);
  const total = dishes.reduce((s, d) => s + (qty[d.id] ?? 0) * d.price, 0);
  const over = total > budgetPaise;
  const set = (id: number, n: number) => setQty((q) => ({ ...q, [id]: Math.max(0, Math.min(10, n)) }));

  function save() {
    onSave(Object.entries(qty).filter(([, n]) => n > 0).map(([id, n]) => ({ dishId: Number(id), quantity: n })));
  }

  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col gap-2">
        {dishes.map((d) => {
          const n = qty[d.id] ?? 0;
          return (
            <li key={d.id} className="flex items-center justify-between gap-3 rounded-xl border border-line bg-surface px-3 py-2">
              <div className="min-w-0">
                <p className="truncate text-sm text-ink">{d.name}</p>
                <p className="tabular text-xs text-ink-faint">{formatPaise(d.price)}</p>
              </div>
              <div className="flex items-center gap-2 rounded-lg border border-line px-2 py-1">
                <button type="button" disabled={n === 0} onClick={() => set(d.id, n - 1)} aria-label="Decrease" className="text-ink-muted disabled:opacity-40">−</button>
                <span className="tabular w-5 text-center text-sm text-ink">{n}</span>
                <button type="button" onClick={() => set(d.id, n + 1)} aria-label="Increase" className="text-ink-muted">+</button>
              </div>
            </li>
          );
        })}
      </ul>
      <div className="flex items-center justify-between text-sm">
        <span className="text-ink-muted">Your total</span>
        <span className={`tabular font-semibold ${over ? "text-[var(--danger)]" : "text-ink"}`}>{formatPaise(total)} / {formatPaise(budgetPaise)}</span>
      </div>
      {over && <p className="text-xs text-[var(--danger)]">Over your per-person budget.</p>}
      <button type="button" onClick={save} disabled={busy || over || total === 0} className="rounded-xl bg-gold px-6 py-3 text-sm font-semibold text-[var(--gold-ink)] disabled:opacity-60">
        {busy ? "Saving…" : Object.keys(initial).length ? "Update my pick" : "Lock my pick"}
      </button>
    </div>
  );
}
