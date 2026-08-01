"use client";
// Client: owns the address list state + CRUD calls against the live api,
// via TanStack Query (list = useQuery, every write = useMutation that
// invalidates the list rather than hand-patching local state).
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { getAddresses, createAddress, updateAddress, deleteAddress, ApiError, type Address, type AddressInput } from "@/lib/api";
import { PhoneAuth } from "@/components/checkout/PhoneAuth";
import { AddressList } from "./AddressList";
import { AddressForm } from "./AddressForm";
import { LocationPickerFlow } from "@/components/address/LocationPickerFlow";
import { Skeleton } from "@/components/ui/skeleton";

type Editing = null | "new" | Address;

const ADDRESSES_KEY = ["account", "addresses"] as const;

/** A 401 mid-session means the sid session lapsed — refetching the list
 *  surfaces the same 401, which then renders the sign-in offer below. */
function isAuthExpired(e: unknown): boolean {
  return e instanceof ApiError && e.status === 401;
}

/**
 * SF-04 CRUD surface. Session-gated: an unauthenticated load 401s, and we show
 * the Firebase sign-in (SF-03) inline; verifying refetches the list. Every
 * mutation hits the real /addresses endpoints — the server owns serviceability
 * and the single-default invariant, so this just reflects its responses.
 */
export function AddressManager() {
  const queryClient = useQueryClient();
  const {
    data: addresses,
    isPending,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ADDRESSES_KEY,
    queryFn: async () => (await getAddresses()).addresses,
  });

  const [editing, setEditing] = useState<Editing>(null);
  const [pickingLocation, setPickingLocation] = useState(false);
  const [prefill, setPrefill] = useState<Partial<Address> | undefined>(undefined);
  const [formError, setFormError] = useState<string | null>(null);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ADDRESSES_KEY });

  const save = useMutation({
    mutationFn: (value: AddressInput) =>
      editing && editing !== "new" ? updateAddress(editing.id, value) : createAddress(value),
    onSuccess: async () => {
      setFormError(null);
      setEditing(null);
      await invalidate();
    },
    onError: (e) => {
      if (isAuthExpired(e)) {
        setEditing(null);
        void refetch();
        return;
      }
      setFormError(e instanceof ApiError ? e.message : "Couldn't save the address.");
    },
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteAddress(id),
    onMutate: (id) => {
      setMutationError(null);
      setBusyId(id);
    },
    onSuccess: () => invalidate(),
    onError: (e) => {
      if (isAuthExpired(e)) {
        void refetch();
        return;
      }
      // Surface it — the list is unchanged, but never fail silently.
      setMutationError(e instanceof ApiError ? e.message : "Couldn't update the address.");
    },
    onSettled: () => setBusyId(null),
  });

  const setDefault = useMutation({
    mutationFn: (id: string) => updateAddress(id, { isDefault: true }),
    onMutate: (id) => {
      setMutationError(null);
      setBusyId(id);
    },
    onSuccess: () => invalidate(),
    onError: (e) => {
      if (isAuthExpired(e)) {
        void refetch();
        return;
      }
      setMutationError(e instanceof ApiError ? e.message : "Couldn't update the address.");
    },
    onSettled: () => setBusyId(null),
  });

  if (isPending) {
    return (
      <div className="flex flex-col gap-3" aria-hidden>
        <Skeleton className="h-24 w-full rounded-xl" />
        <Skeleton className="h-24 w-full rounded-xl" />
      </div>
    );
  }

  if (isError) {
    if (error instanceof ApiError && error.status === 401) {
      return (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-ink-muted">Sign in to view and manage your saved addresses.</p>
          <PhoneAuth startExpanded onVerified={() => void refetch()} />
        </div>
      );
    }
    return (
      <div className="rounded-2xl border border-line bg-surface px-6 py-10 text-center">
        <p className="text-sm font-semibold text-[var(--danger)]">Couldn&rsquo;t load your addresses</p>
        <p className="mx-auto mt-1.5 max-w-xs text-xs leading-relaxed text-ink-faint">
          Something went wrong on our end — this usually clears up on retry.
        </p>
        <button
          type="button"
          onClick={() => void refetch()}
          className="mt-4 rounded-lg border border-line px-5 py-2 text-xs font-semibold text-gold-text transition-opacity hover:opacity-80"
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {mutationError && <p role="alert" className="text-xs font-medium text-[var(--danger)]">{mutationError}</p>}
      <AddressList
        addresses={addresses}
        busyId={busyId}
        onEdit={(a) => { setFormError(null); setEditing(a); }}
        onDelete={(id) => remove.mutate(id)}
        onSetDefault={(id) => setDefault.mutate(id)}
      />
      {pickingLocation && (
        <LocationPickerFlow
          onClose={() => setPickingLocation(false)}
          onSelectLocation={(p) => { setPickingLocation(false); setPrefill({ line1: p.formattedAddress, city: p.city, pincode: p.pincode }); setEditing("new"); }}
          onManualFallback={() => { setPickingLocation(false); setPrefill(undefined); setEditing("new"); }}
        />
      )}
      {editing ? (
        <AddressForm
          key={editing === "new" ? "new" : editing.id}
          initial={editing === "new" ? prefill : editing}
          busy={save.isPending}
          error={formError}
          submitLabel={editing === "new" ? "Save address" : "Update address"}
          onSubmit={(value) => save.mutate(value)}
          onCancel={() => setEditing(null)}
        />
      ) : (
        <Button
          type="button"
          onClick={() => { setFormError(null); setPrefill(undefined); setPickingLocation(true); }}
          shape="xl" size="fluid" className="self-start px-5 py-3 font-semibold"
        >
          Add an address
        </Button>
      )}
    </div>
  );
}
