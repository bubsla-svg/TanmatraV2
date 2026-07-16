import { useMemo, useState } from "react";
import { useParams, Link, useNavigate } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { formatPrice } from "@/lib/api/adapter";
import { useGroupOrder, groupOrdersApi } from "@/lib/queries";
import { useCart } from "@/lib/cartContext";
import { API_BASE } from "@/lib/apiBase";
import { getDishById } from "@workspace/menu-catalog";

/* Full-parity re-port of the System-A GroupOrder (git 2507084, 329 lines) into
 * the v2 (.tnm2) design language — same hooks / handlers / groupOrdersApi calls
 * / share-code + close-&-checkout money path, v2 UI. Transactional: logic is
 * preserved verbatim; only the presentation is re-skinned. */

export default function V2GroupOrder() {
  const { code: rawCode } = useParams<{ code: string }>();
  const code = (rawCode ?? "").toUpperCase();
  const navigate = useNavigate();
  const { data: group, isLoading, error, refetch } = useGroupOrder(code);
  const { addItem } = useCart();
  const [copied, setCopied] = useState(false);
  const [closing, setClosing] = useState(false);

  // Same identity the server checks (it 403s non-hosts on close) — used to
  // gate the "Close & checkout" UI on the client too.
  const { data: authUser } = useQuery({
    queryKey: ["auth", "user"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/auth/user`, { credentials: "include" });
      if (!res.ok) throw new Error(`${res.status}`);
      const data = (await res.json()) as { user: { id: string } | null };
      return data.user;
    },
    staleTime: 30_000,
    retry: false,
  });
  const isHost = !!group?.hostUserId && authUser?.id === group.hostUserId;

  const subtotal = useMemo(
    () => (group?.items ?? []).reduce((s, it) => s + it.unitPrice * it.quantity, 0),
    [group],
  );

  const shareUrl = useMemo(() => {
    if (typeof window === "undefined") return "";
    return `${window.location.origin}${import.meta.env.BASE_URL.replace(/\/$/, "")}/group/${code}`;
  }, [code]);

  const copyShare = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
      toast.success("Group link copied");
    } catch {
      toast.error("Could not copy link");
    }
  };

  const removeLine = async (lineId: string) => {
    try {
      await groupOrdersApi.removeLine(code, lineId);
      await refetch();
    } catch {
      toast.error("Could not remove item");
    }
  };

  const closeAndCheckout = async () => {
    if (!group) return;
    if (group.items.length === 0) {
      toast.error("Add at least one item before closing");
      return;
    }
    setClosing(true);
    try {
      // Server enforces "host only"; non-hosts will get 403. Use the
      // close response as source of truth — it includes any item added
      // since our last poll. Group items are MERGED into the host's cart
      // (never replacing what's already in it).
      const { group: closed } = await groupOrdersApi.close(code);
      let unresolved = 0;
      for (const it of closed.items) {
        // Resolve canonical dish metadata from the catalog so cart
        // preference checks, macros, and routing all work correctly.
        const dish = getDishById(it.dishId);
        if (!dish) {
          unresolved++;
          continue;
        }
        addItem({
          dishId: dish.id,
          slug: dish.slug,
          name: dish.name,
          image: dish.image,
          basePrice: dish.price,
          unitPrice: dish.price,
          quantity: it.quantity,
          kitchen: dish.kitchen,
          isVeg: dish.isVeg,
          rdVerified: dish.rdVerified,
          macros: dish.macros,
          customizations: it.customizations,
        });
      }
      if (unresolved > 0) {
        toast.warning(
          `${unresolved} item${unresolved === 1 ? "" : "s"} could not be transferred`,
        );
      }
      toast.success(`Group order ${code} closed — items added to your cart`);
      navigate("/checkout");
    } catch {
      toast.error("Only the host can close this group order");
      setClosing(false);
    }
  };

  // ---- No code ----
  if (!code) {
    return (
      <div className="tnm2 nn" style={{ minHeight: "100vh", background: "var(--bg)" }}>
        <div style={{ maxWidth: 480, margin: "0 auto" }}>
          <div className="appbar">
            <Link className="iconbtn" to="/menu"><i className="ph-bold ph-arrow-left" /></Link>
            <div className="abt">Group order</div>
          </div>
          <div className="padx tc" style={{ paddingTop: 60 }}>
            <div className="fine">No group code provided.</div>
          </div>
        </div>
      </div>
    );
  }

  // ---- Loading ----
  if (isLoading) {
    return (
      <div className="tnm2 nn" style={{ minHeight: "100vh", background: "var(--bg)" }}>
        <div style={{ maxWidth: 480, margin: "0 auto" }}>
          <div className="appbar">
            <Link className="iconbtn" to="/menu"><i className="ph-bold ph-arrow-left" /></Link>
            <div className="abt">Group order</div>
          </div>
          <div className="content padx" style={{ paddingTop: 4 }}>
            <div className="card mb10">
              <div className="skel mb10" style={{ height: 16, width: 96 }} />
              <div className="skel mb10" style={{ height: 28, width: "70%" }} />
              <div className="skel" style={{ height: 14, width: "50%" }} />
            </div>
            <div className="skel mb10" style={{ height: 64, width: "100%" }} />
            <div className="card">
              <div className="skel mb10" style={{ height: 18, width: "40%" }} />
              <div className="skel mb10" style={{ height: 56, width: "100%" }} />
              <div className="skel" style={{ height: 56, width: "100%" }} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ---- Error / not found ----
  if (error || !group) {
    return (
      <div className="tnm2 nn" style={{ minHeight: "100vh", background: "var(--bg)" }}>
        <div style={{ maxWidth: 480, margin: "0 auto" }}>
          <div className="appbar">
            <Link className="iconbtn" to="/menu"><i className="ph-bold ph-arrow-left" /></Link>
            <div className="abt">Group order</div>
          </div>
          <div className="padx tc" style={{ paddingTop: 60 }}>
            <div className="avatar big" style={{ margin: "0 auto" }}><i className="ph-bold ph-users" /></div>
            <div className="tt mt20">Group <span className="mono" style={{ letterSpacing: ".08em" }}>{code}</span> was not found</div>
            <div className="fine mt6">This group order may have been closed or the code is incorrect.</div>
            <Link className="btn btn-p btn-blk mt20" to="/menu"><i className="ph-bold ph-fork-knife" /> Browse menu</Link>
          </div>
        </div>
      </div>
    );
  }

  const isOpen = group.status === "open";

  return (
    <div className="tnm2 nn" style={{ minHeight: "100vh", background: "var(--bg)" }}>
      <div style={{ maxWidth: 480, margin: "0 auto", minHeight: "100vh", display: "flex", flexDirection: "column" }}>
        {/* App bar */}
        <div className="appbar">
          <Link className="iconbtn" to="/menu"><i className="ph-bold ph-arrow-left" /></Link>
          <div className="abt">Group order</div>
          <button className="fine" onClick={copyShare} style={{ color: "var(--safb)" }} aria-label="Share group link">
            <i className={copied ? "ph-bold ph-check" : "ph-bold ph-share-network"} /> {copied ? "Copied!" : "Share"}
          </button>
        </div>

        <div className="content padx" style={{ paddingTop: 4, paddingBottom: isOpen ? 132 : 24 }}>
          {/* Header card: code, status, host, participants */}
          <div className="card mb10">
            <div className="lab mb6">Group order</div>
            <div className="fx ac gap8" style={{ minWidth: 0 }}>
              <i className="ph-bold ph-users" style={{ fontSize: 22, color: "var(--safb)", flex: "none" }} />
              <span className="h2 mono" style={{ letterSpacing: ".1em", minWidth: 0 }}>{group.code}</span>
              <span className={isOpen ? "pill sg" : "pill"} style={{ flex: "none" }}>{isOpen ? "OPEN" : "CLOSED"}</span>
            </div>
            <div className="fine mt6">
              Hosted by <span style={{ color: "var(--tx)", fontWeight: 500 }}>{group.hostName}</span> · {group.participants.length} participant{group.participants.length === 1 ? "" : "s"}
            </div>
            {group.participants.length > 0 && (
              <div className="fx ac g6 wrap mt10">
                {group.participants.map((p) => (
                  <span key={p.id} className="pill"><i className="ph-fill ph-user" style={{ fontSize: 11 }} />{p.name}</span>
                ))}
              </div>
            )}
          </div>

          {/* Share-code explainer */}
          <div className="banner mb10 fx gap8" style={{ alignItems: "flex-start" }}>
            <i className="ph-fill ph-sparkle" style={{ color: "var(--safb)", flex: "none", marginTop: 1 }} />
            <span className="fine">
              Share code <span className="mono" style={{ color: "var(--safb)" }}>{code}</span> or the link above. Anyone with the link can add their own items. The host closes the order and pays for everyone.
            </span>
          </div>

          {/* Add-your-items door (open only) */}
          {isOpen && (
            <div className="card mb10 fx ac jb gap12">
              <div style={{ minWidth: 0 }}>
                <div className="tt" style={{ fontSize: 14 }}>Add your items</div>
                <div className="fine mt2">Browse the menu, then come back to add to this group.</div>
              </div>
              <Link to={`/menu?group=${code}`} className="btn btn-p" style={{ height: 40, flex: "none" }}>
                <i className="ph-bold ph-shopping-bag" /> Browse
              </Link>
            </div>
          )}

          {/* Items in this group */}
          <div className="fx ac jb mb10 mt14">
            <span className="sh">Items in this group</span>
            <span className="lab">{group.items.length} line{group.items.length === 1 ? "" : "s"}</span>
          </div>

          {group.items.length === 0 ? (
            <div className="card tc" style={{ padding: "28px 16px" }}>
              <i className="ph-bold ph-shopping-bag" style={{ fontSize: 28, color: "var(--fnt)" }} />
              <div className="fine mt6">No items yet. Share the code with friends to get started.</div>
            </div>
          ) : (
            <>
              {group.items.map((it) => (
                <div key={it.lineId} className="dcard" style={{ padding: 12, marginBottom: 8 }}>
                  <div className="fx ac gap12">
                    <div className="dimg" style={{ width: 52, height: 52, borderRadius: 10, backgroundImage: `url(${it.image})`, backgroundSize: "cover", backgroundPosition: "center", flex: "none" }} aria-label={it.name} />
                    <div className="f1" style={{ minWidth: 0 }}>
                      <div className="small clamp1" style={{ fontWeight: 600 }}>{it.name}</div>
                      <div className="fine mt2">
                        Added by <span style={{ color: "var(--safb)" }}>{it.addedByName}</span> · Qty {it.quantity}
                      </div>
                      {it.customizations.length > 0 && (
                        <div className="fx ac g6 wrap mt6">
                          {it.customizations.map((cz, i) => <span key={i} className="pill" style={{ fontSize: 10 }}>{cz}</span>)}
                        </div>
                      )}
                    </div>
                    <div className="fx ac gap8" style={{ flex: "none" }}>
                      <span className="price" style={{ fontSize: 14, color: "var(--tx)" }}>{formatPrice(it.unitPrice * it.quantity)}</span>
                      {isOpen && (
                        <button className="qbtn" style={{ width: 30, height: 30 }} onClick={() => removeLine(it.lineId)} aria-label="Remove line">
                          <i className="ph-bold ph-trash" style={{ fontSize: 14 }} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}

              {/* Subtotal */}
              <div className="card mt10">
                <div className="billrow tot" style={{ borderTop: "none", marginTop: 0, paddingTop: 0 }}>
                  <span>Group subtotal</span>
                  <span className="price" style={{ fontSize: 17, color: "var(--safb)" }}>{formatPrice(subtotal)}</span>
                </div>
              </div>
            </>
          )}

          {/* Closed note */}
          {!isOpen && (
            <div className="note mt10" style={{ background: "var(--s2)", borderColor: "var(--ln2)", color: "var(--mut)" }}>
              <i className="ph-bold ph-lock-simple" />
              <span>This group order is closed. The host has moved everything to checkout.</span>
            </div>
          )}
        </div>

        {/* Sticky dock — close & checkout (open only) */}
        {isOpen && (
          <div className="dock">
            <div className="fx ac gap12">
              <button className="btn btn-g" style={{ flex: "none" }} onClick={copyShare} aria-label="Copy group link">
                <i className={copied ? "ph-bold ph-check" : "ph-bold ph-copy"} />
              </button>
              {isHost ? (
                <button
                  className={closing || group.items.length === 0 ? "btn btn-p f1 dis" : "btn btn-p f1"}
                  disabled={closing || group.items.length === 0}
                  onClick={closeAndCheckout}
                >
                  <i className="ph-bold ph-lock-simple" /> {closing ? "Closing…" : "Close & checkout"} <i className="ph-bold ph-arrow-right" />
                </button>
              ) : (
                <Link to={`/menu?group=${code}`} className="btn btn-s f1">
                  <i className="ph-bold ph-shopping-bag" /> Add your items
                </Link>
              )}
            </div>
            <div className="fine tc mt6">
              Only <span style={{ color: "var(--tx)" }}>{group.hostName}</span> (the host) can close this order and pay for everyone.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
