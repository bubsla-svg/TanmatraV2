"use client";
// Client: kinetic squircle button allowing 1-click dish bookmarking to Protocol Vault.
import { useState } from "react";
import { saveMealToVault } from "@/lib/savedMealsApi";

interface SaveToVaultProps {
  dishSlug: string;
  dishName: string;
  defaultSaved?: boolean;
}

export function SaveToVaultButton({ dishSlug, dishName, defaultSaved = false }: SaveToVaultProps) {
  const [saved, setSaved] = useState(defaultSaved);
  const [busy, setBusy] = useState(false);

  async function handleToggle() {
    if (busy || saved) return;
    setBusy(true);
    try {
      await saveMealToVault({ dishSlug, dishName, tags: ["custom-favorite"] });
      setSaved(true);
    } catch {
      // Offline fallback: optimistically mark saved
      setSaved(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleToggle}
      disabled={busy}
      className={`rounded-xl border px-3 py-2 text-xs font-semibold transition-all duration-200 ${
        saved
          ? "border-gold bg-gold/10 text-gold-text cursor-default"
          : "border-line bg-surface text-ink-muted hover:border-ink/30 hover:text-ink active:scale-95"
      }`}
    >
      {saved ? "&starf; Saved to Vault" : "+ Save to Vault"}
    </button>
  );
}
