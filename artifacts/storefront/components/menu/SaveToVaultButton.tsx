"use client";
// Client: kinetic squircle button allowing 1-click dish bookmarking to Protocol Vault.
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ApiError } from "@/lib/apiClient";
import { saveMealToVault } from "@/lib/savedMealsApi";
import { PhoneAuth } from "@/components/checkout/PhoneAuth";

interface SaveToVaultProps {
  dishSlug: string;
  dishName: string;
  defaultSaved?: boolean;
}

export function SaveToVaultButton({ dishSlug, dishName, defaultSaved = false }: SaveToVaultProps) {
  const queryClient = useQueryClient();
  const [saved, setSaved] = useState(defaultSaved);
  // Finding #3: a signed-out save 401s — offer sign-in in place rather than
  // faking success or dead-ending the user.
  const [needsAuth, setNeedsAuth] = useState(false);

  const saveMutation = useMutation({
    mutationFn: () => saveMealToVault({ dishSlug, dishName, tags: ["custom-favorite"] }),
    onSuccess: () => {
      setSaved(true);
      setNeedsAuth(false);
      void queryClient.invalidateQueries({ queryKey: ["account", "vault"] });
    },
    onError: (e) => {
      if (e instanceof ApiError && e.status === 401) setNeedsAuth(true);
    },
  });

  if (needsAuth) {
    return (
      <div className="flex flex-col gap-2">
        <p className="text-xs text-ink-muted">Sign in to save to your Vault.</p>
        <PhoneAuth startExpanded onVerified={() => saveMutation.mutate()} />
      </div>
    );
  }

  function handleToggle() {
    if (saveMutation.isPending || saved) return;
    saveMutation.mutate();
  }

  const failed = saveMutation.isError && !saved;

  return (
    <div className="flex flex-col gap-1.5">
      <button
        type="button"
        onClick={handleToggle}
        disabled={saveMutation.isPending}
        aria-busy={saveMutation.isPending}
        aria-live="polite"
        className={`rounded-xl border px-3 py-2 text-xs font-semibold transition-all duration-200 ${
          saved
            ? "border-gold bg-gold/10 text-gold-text cursor-default"
            : "border-line bg-surface text-ink-muted hover:border-ink/30 hover:text-ink active:scale-95"
        }`}
      >
        {saved ? "★ Saved to Vault" : saveMutation.isPending ? "Saving…" : "+ Save to Vault"}
      </button>
      {failed && (
        <p role="alert" className="text-2xs font-medium text-danger">
          Couldn&rsquo;t save. Try again.
        </p>
      )}
    </div>
  );
}
