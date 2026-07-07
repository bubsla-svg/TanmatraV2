import { useEffect, useState } from "react";
import { Link } from "react-router";
import { toast } from "sonner";
import { LocationPickerFlow } from "@/components/location/LocationPickerFlow";
import { addressesApi, type UserAddress } from "@/lib/userAddressesApi";

// Phosphor font-icon (ph-*) equivalents of the old lucide/phosphor-react icons.
const TYPE_ICON: Record<UserAddress["type"], string> = {
  home: "ph-house",
  work: "ph-buildings",
  other: "ph-map-pin",
};

export default function V2Addresses() {
  const [addresses, setAddresses] = useState<UserAddress[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [editing, setEditing] = useState<UserAddress | null>(null);
  const [adding, setAdding] = useState(false);

  const reload = async () => {
    try {
      const r = await addressesApi.list();
      setAddresses(r.addresses);
      setError(false);
    } catch {
      setError(true);
      toast.error("Could not load addresses");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void reload();
  }, []);

  const retry = () => {
    setLoading(true);
    void reload();
  };

  const openAdd = () => {
    setAdding(true);
  };

  const openEdit = (addr: UserAddress) => {
    setEditing(addr);
  };

  const close = () => {
    setAdding(false);
    setEditing(null);
  };

  const handleDelete = async (addr: UserAddress) => {
    if (!confirm(`Delete "${addr.label}"? This cannot be undone.`)) return;
    try {
      await addressesApi.remove(addr.id);
      toast.success("Address deleted");
      await reload();
    } catch {
      toast.error("Could not delete address");
    }
  };

  const handleSetDefault = async (addr: UserAddress) => {
    try {
      await addressesApi.update(addr.id, { isDefault: true });
      await reload();
    } catch {
      toast.error("Could not set default");
    }
  };

  return (
    <div className="tnm2" style={{ minHeight: "100vh", background: "var(--bg)" }}>
      <div style={{ maxWidth: 480, margin: "0 auto" }}>
        <div className="appbar">
          <Link className="iconbtn" to="/account" aria-label="Back to account">
            <i className="ph-bold ph-arrow-left" />
          </Link>
          <div className="abt">Address book</div>
        </div>

        <div className="content padx" style={{ paddingTop: 4, paddingBottom: 24 }}>
          <p className="fine mb14">
            Saved delivery addresses used at checkout and on subscription
            deliveries.
          </p>

          {loading ? (
            <>
              {[0, 1].map((i) => (
                <div key={i} className="card mb10">
                  <div className="fx gap12">
                    <div
                      className="skel"
                      style={{ width: 40, height: 40, borderRadius: 10, flex: "none" }}
                    />
                    <div className="f1">
                      <div className="skel" style={{ height: 14, width: "40%" }} />
                      <div className="skel mt6" style={{ height: 12, width: "82%" }} />
                      <div className="skel mt6" style={{ height: 12, width: "55%" }} />
                    </div>
                  </div>
                </div>
              ))}
            </>
          ) : error ? (
            <div className="tc" style={{ padding: "44px 20px" }}>
              <i
                className="ph-bold ph-warning-circle"
                style={{ fontSize: 30, color: "var(--dgr)" }}
              />
              <div className="tt mt10">Could not load addresses</div>
              <div className="fine mt6">Check your connection and try again.</div>
              <button className="btn btn-g mt20" onClick={retry}>
                <i className="ph-bold ph-arrow-clockwise" />
                Retry
              </button>
            </div>
          ) : (
            <>
              {addresses.length === 0 ? (
                <div className="tc" style={{ padding: "40px 20px 28px" }}>
                  <i
                    className="ph-bold ph-map-pin"
                    style={{ fontSize: 30, color: "var(--fnt)" }}
                  />
                  <div className="tt mt10">No saved addresses yet</div>
                  <div className="fine mt6">
                    Save a place once, reuse it on every order.
                  </div>
                  <button className="btn btn-p mt20" onClick={openAdd}>
                    <i className="ph-bold ph-plus" />
                    Add address
                  </button>
                </div>
              ) : (
                addresses.map((addr) => {
                  const icon = TYPE_ICON[addr.type] ?? "ph-map-pin";
                  return (
                    <div key={addr.id} className="card mb10">
                      <div className="fx gap12">
                        <div className="dic" style={{ color: "var(--safb)" }}>
                          <i className={`ph-bold ${icon}`} aria-hidden />
                        </div>
                        <div className="f1" style={{ minWidth: 0 }}>
                          <div className="fx ac g6 wrap">
                            <span className="tt">{addr.label}</span>
                            {addr.isDefault && (
                              <span className="pill sg">
                                <i className="ph-fill ph-check-circle" />
                                Default
                              </span>
                            )}
                          </div>
                          <p className="fine mt4">
                            {addr.line1}
                            {addr.line2 ? `, ${addr.line2}` : ""}
                            <br />
                            {addr.city} — {addr.pincode}
                          </p>
                          <p className="fine mt2">{addr.phone}</p>
                        </div>
                      </div>

                      <div className="fx gap8 mt12">
                        <button
                          className="btn btn-g f1"
                          onClick={() => openEdit(addr)}
                        >
                          <i className="ph-bold ph-pencil-simple" />
                          Edit
                        </button>
                        {!addr.isDefault && (
                          <button
                            className="btn btn-s f1"
                            onClick={() => handleSetDefault(addr)}
                          >
                            <i className="ph-bold ph-check-circle" />
                            Set default
                          </button>
                        )}
                        <button
                          className="btn btn-g"
                          onClick={() => handleDelete(addr)}
                          aria-label={`Delete ${addr.label}`}
                        >
                          <i className="ph-bold ph-trash" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}

              {addresses.length > 0 && (
                <div className="card mt14" style={{ borderStyle: "dashed" }}>
                  <div className="fx ac gap12">
                    <div className="iconbtn" aria-hidden>
                      <i className="ph-bold ph-plus" />
                    </div>
                    <div className="f1" style={{ minWidth: 0 }}>
                      <div className="small" style={{ fontWeight: 600 }}>
                        Add a new address
                      </div>
                      <div className="fine">
                        Save a place once, reuse it on every order.
                      </div>
                    </div>
                  </div>
                  <button className="btn btn-p btn-blk mt12" onClick={openAdd}>
                    <i className="ph-bold ph-map-pin" />
                    Add address
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        <LocationPickerFlow
          open={adding || editing !== null}
          onOpenChange={(open) => {
            if (!open) close();
          }}
          onSave={async (addressData) => {
            if (editing) {
              await addressesApi.update(editing.id, addressData);
              toast.success("Address updated");
            } else {
              await addressesApi.create(addressData);
              toast.success("Address saved");
            }
            await reload();
            close();
          }}
          initialData={editing || undefined}
        />
      </div>
    </div>
  );
}
