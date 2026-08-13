"use client";
// Office-lunch dish picker: qty steppers + running total vs the per-person
// budget. Server re-prices and re-enforces the budget on save (this is display).
import { useState } from "react";
import { formatPaise } from "@/lib/format";
import type { DishData } from "@workspace/menu-catalog";
import { Button } from "@/components/ui/button";

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
    <div className="flex flex-col gap-6">
      <ul className="flex flex-col">
        {dishes.map((d, i) => {
          const n = qty[d.id] ?? 0;
          return (
            <li key={d.id} className={`flex items-center justify-between gap-3 py-4 ${i === 0 ? "pt-0" : ""} ${i === dishes.length - 1 ? "" : "border-b border-line"}`}>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-ink">{d.name}</p>
                <p className="tabular text-xs text-ink-faint">{formatPaise(d.price)}</p>
              </div>
              <div className="flex h-8 items-center rounded-full border border-line">
                <button type="button" disabled={n === 0} onClick={() => set(d.id, n - 1)} aria-label="Decrease" className="flex h-full w-8 items-center justify-center text-ink-muted disabled:opacity-30">−</button>
                <span className="tabular w-5 text-center text-sm font-medium text-ink">{n}</span>
                <button type="button" onClick={() => set(d.id, n + 1)} aria-label="Increase" className="flex h-full w-8 items-center justify-center text-ink-muted">+</button>
              </div>
            </li>
          );
        })}
      </ul>
      <div className="flex flex-col gap-1 border-t border-line pt-4">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium text-ink-muted">Your total</span>
          <span className={`tabular font-semibold ${over ? "text-[var(--danger)]" : "text-ink"}`}>{formatPaise(total)} / {formatPaise(budgetPaise)}</span>
        </div>
        {over && <p className="text-xs text-[var(--danger)]">Over your per-person budget.</p>}
      </div>
      <Button type="button" onClick={save} disabled={busy || over || total === 0} aria-busy={busy} aria-live="polite" shape="xl" size="fluid" className="px-6 py-3 font-semibold disabled:opacity-60">
        {busy ? "Saving…" : Object.keys(initial).length ? "Update my pick" : "Lock my pick"}
      </Button>
    </div>
  );
}
