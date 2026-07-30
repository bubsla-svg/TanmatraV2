"use client";
// Client: owns the address list state + CRUD calls against the live api.
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { getAddresses, createAddress, updateAddress, deleteAddress, ApiError, type Address, type AddressInput } from "@/lib/api";
import { PhoneAuth } from "@/components/checkout/PhoneAuth";
import { AddressList } from "./AddressList";
import { AddressForm } from "./AddressForm";
import { LocationPickerFlow } from "@/components/address/LocationPickerFlow";

type Editing = null | "new" | Address;

/** A 401 mid-session means the sid session lapsed — route back to sign-in. */
function isAuthExpired(e: unknown): boolean {
  return e instanceof ApiError && e.status === 401;
}

/**
 * SF-04 CRUD surface. Session-gated: an unauthenticated load 401s, and we show
 * the Firebase sign-in (SF-03) inline; verifying reloads the list. Every
 * mutation hits the real /addresses endpoints — the server owns serviceability
 * and the single-default invariant, so this just reflects its responses.
 */
export function AddressManager() {
  const [addresses, setAddresses] = useState<Address[] | null>(null);
  const [needsAuth, setNeedsAuth] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Editing>(null);
  const [pickingLocation, setPickingLocation] = useState(false);
  const [prefill, setPrefill] = useState<Partial<Address> | undefined>(undefined);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [formBusy, setFormBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const { addresses } = await getAddresses();
      setAddresses(addresses);
      setNeedsAuth(false);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) setNeedsAuth(true);
      else setLoadError(e instanceof ApiError ? e.message : "Couldn't load your addresses.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function save(value: AddressInput) {
    setFormBusy(true);
    setFormError(null);
    try {
      if (editing && editing !== "new") await updateAddress(editing.id, value);
      else await createAddress(value);
      setEditing(null);
      await load();
    } catch (e) {
      if (isAuthExpired(e)) {
        setEditing(null);
        setNeedsAuth(true);
        return;
      }
      setFormError(e instanceof ApiError ? e.message : "Couldn't save the address.");
    } finally {
      setFormBusy(false);
    }
  }

  async function mutate(id: string, run: () => Promise<unknown>) {
    setBusyId(id);
    setLoadError(null);
    try {
      await run();
      await load();
    } catch (e) {
      if (isAuthExpired(e)) {
        setNeedsAuth(true);
        return;
      }
      // Surface it — the list is unchanged, but never fail silently.
      setLoadError(e instanceof ApiError ? e.message : "Couldn't update the address.");
    } finally {
      setBusyId(null);
    }
  }

  if (needsAuth) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-sm text-ink-muted">Sign in to view and manage your saved addresses.</p>
        <PhoneAuth onVerified={() => void load()} />
      </div>
    );
  }

  if (addresses === null) {
    return <p className="text-sm text-ink-muted">{loadError ?? "Loading your addresses…"}</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      {loadError && <p role="alert" className="text-xs font-medium text-[var(--danger)]">{loadError}</p>}
      <AddressList
        addresses={addresses}
        busyId={busyId}
        onEdit={(a) => { setFormError(null); setEditing(a); }}
        onDelete={(id) => void mutate(id, () => deleteAddress(id))}
        onSetDefault={(id) => void mutate(id, () => updateAddress(id, { isDefault: true }))}
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
          busy={formBusy}
          error={formError}
          submitLabel={editing === "new" ? "Save address" : "Update address"}
          onSubmit={save}
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
