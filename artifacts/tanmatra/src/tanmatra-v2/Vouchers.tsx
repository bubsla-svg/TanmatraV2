import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import { toast } from "sonner";
import { corporateApi, type Voucher } from "@/lib/corporateApi";
import { formatPrice } from "@/lib/api/adapter";

const PRESET_AMOUNTS = [50000, 100000, 250000, 500000];

export default function V2Vouchers() {
  const navigate = useNavigate();
  const [purchased, setPurchased] = useState<Voucher[]>([]);
  const [redeemed, setRedeemed] = useState<Voucher[]>([]);
  const [amountPaise, setAmountPaise] = useState(100000);
  const [recipientEmail, setRecipientEmail] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [message, setMessage] = useState("");
  const [redeemCode, setRedeemCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [unauthorized, setUnauthorized] = useState(false);

  const refresh = async () => {
    try {
      const r = await corporateApi.myVouchers();
      setPurchased(r.purchased);
      setRedeemed(r.redeemed);
    } catch (e) {
      if (String((e as Error).message).startsWith("401")) setUnauthorized(true);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  const handlePurchase = async () => {
    if (amountPaise < 10_000) {
      toast.error("Minimum ₹ 100");
      return;
    }
    setBusy(true);
    try {
      const r = await corporateApi.purchaseVoucher({
        amountPaise,
        recipientEmail: recipientEmail || undefined,
        recipientName: recipientName || undefined,
        message: message || undefined,
      });
      toast.success(`Voucher ${r.voucher.code} purchased`, {
        description: "Code copied to clipboard — share it with the recipient.",
        action: {
          label: "Copy code",
          onClick: () => {
            navigator.clipboard?.writeText(r.voucher.code);
            toast.success("Code copied");
          },
        },
      });
      try {
        await navigator.clipboard?.writeText(r.voucher.code);
      } catch {
        // best-effort; toast action above remains
      }
      setRecipientEmail("");
      setRecipientName("");
      setMessage("");
      refresh();
    } catch (e) {
      const msg = String((e as Error)?.message ?? e);
      if (msg.includes("401")) {
        toast.error("Sign in to purchase a voucher", {
          action: {
            label: "Sign in",
            onClick: () => navigate("/login?next=/vouchers"),
          },
        });
      } else {
        toast.error("Could not purchase voucher — please try again");
      }
    } finally {
      setBusy(false);
    }
  };

  const handleRedeem = async () => {
    if (!redeemCode.trim()) {
      toast.error("Enter a code");
      return;
    }
    setBusy(true);
    try {
      const r = await corporateApi.redeemVoucher(redeemCode.trim());
      toast.success(`Redeemed ${formatPrice(r.creditedPaise)} to your wallet`, {
        action: { label: "View wallet", onClick: () => navigate("/rewards") },
      });
      setRedeemCode("");
      refresh();
    } catch (e) {
      const msg = String((e as Error).message);
      if (msg.includes("401")) {
        toast.error("Sign in to redeem a code", {
          action: {
            label: "Sign in",
            onClick: () => navigate("/login?next=/vouchers"),
          },
        });
      } else {
        toast.error(
          msg.includes("404")
            ? "Code not found"
            : msg.includes("409")
              ? "Already redeemed"
              : "Could not redeem — please try again",
        );
      }
    } finally {
      setBusy(false);
    }
  };

  if (unauthorized) {
    return (
      <div className="tnm2 nn" style={{ minHeight: "100vh", background: "var(--bg)" }}>
        <div style={{ maxWidth: 480, margin: "0 auto" }}>
          <div className="appbar">
            <Link className="iconbtn" to="/" aria-label="Home">
              <i className="ph-bold ph-arrow-left" />
            </Link>
            <div className="abt">Vouchers</div>
          </div>
          <div className="content padx">
            <div className="tc" style={{ padding: "56px 20px" }}>
              <i className="ph-bold ph-gift" style={{ fontSize: 34, color: "var(--safb)" }} />
              <div className="h2 mt10" style={{ color: "var(--text-primary)" }}>Wellness vouchers</div>
              <div className="fine mt6">
                Sign in to buy a voucher for a friend or redeem a code into your wallet.
              </div>
              <Link className="btn btn-p mt20" to="/login?next=/vouchers">
                Sign in
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="tnm2 nn" style={{ minHeight: "100vh", background: "var(--bg)" }}>
      <div style={{ maxWidth: 480, margin: "0 auto" }}>
        <div className="appbar">
          <Link className="iconbtn" to="/" aria-label="Home">
            <i className="ph-bold ph-arrow-left" />
          </Link>
          <div className="abt">Vouchers</div>
        </div>

        <div className="content padx" style={{ paddingTop: 4, paddingBottom: 24 }}>
          {/* Hero */}
          <div className="lab" style={{ color: "var(--safb)", display: "flex", alignItems: "center", gap: 6 }}>
            <i className="ph-bold ph-gift" />
            Gift card
          </div>
          <h1 className="disp mt6" style={{ color: "var(--text-primary)" }}>Wellness vouchers</h1>
          <p className="small mut mt6">
            Buy a voucher for a friend or colleague — they redeem it as wallet credit at checkout.
          </p>

          {/* Buy a voucher */}
          <div className="card mt16 mb14">
            <div className="sh mb10">Buy a voucher</div>

            <div className="lab mb6">Amount</div>
            <div className="fx wrap gap8" role="group" aria-label="Voucher amount">
              {PRESET_AMOUNTS.map((p) => (
                <button
                  key={p}
                  className={amountPaise === p ? "chip on" : "chip"}
                  onClick={() => setAmountPaise(p)}
                >
                  {formatPrice(p)}
                </button>
              ))}
            </div>

            <div className="lab mb6 mt14">Gift details (optional)</div>
            <div className="inp mb8">
              <i className="ph-bold ph-envelope-simple" />
              <input
                type="email"
                value={recipientEmail}
                onChange={(e) => setRecipientEmail(e.target.value)}
                placeholder="Recipient email"
                aria-label="Recipient email (optional)"
              />
            </div>
            <div className="inp mb8">
              <i className="ph-bold ph-user" />
              <input
                value={recipientName}
                onChange={(e) => setRecipientName(e.target.value)}
                placeholder="Recipient name"
                aria-label="Recipient name (optional)"
              />
            </div>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              maxLength={512}
              rows={2}
              placeholder="Personal message"
              aria-label="Personal message (optional)"
              className="small"
              style={{
                width: "100%",
                background: "var(--s1)",
                border: "1px solid var(--ln2)",
                borderRadius: 10,
                padding: "12px 14px",
                color: "var(--tx)",
                resize: "vertical",
                outline: "none",
                fontFamily: "inherit",
                lineHeight: 1.45,
              }}
            />

            <button
              className={"btn btn-p btn-lg btn-blk mt14" + (busy ? " dis" : "")}
              onClick={handlePurchase}
              disabled={busy}
            >
              <i className="ph-bold ph-gift" />
              Purchase {formatPrice(amountPaise)} voucher
            </button>
          </div>

          {/* Redeem a voucher */}
          <div className="card mb14">
            <div className="sh fx ac gap8 mb10">
              <i className="ph-bold ph-ticket safc" />
              Redeem a voucher
            </div>
            <div className="fx gap8">
              <div className="inp f1">
                <i className="ph-bold ph-barcode" />
                <input
                  className="mono"
                  placeholder="TM-XXXXXXXXXX"
                  value={redeemCode}
                  onChange={(e) => setRedeemCode(e.target.value.toUpperCase())}
                  aria-label="Voucher code"
                />
              </div>
              <button
                className={"btn btn-p" + (busy ? " dis" : "")}
                onClick={handleRedeem}
                disabled={busy}
              >
                Redeem
              </button>
            </div>
          </div>

          {/* Vouchers you bought */}
          {purchased.length > 0 && (
            <>
              <div className="lab mb6 mt6">Vouchers you bought</div>
              {purchased.map((v) => (
                <div key={v.id} className="card mb10">
                  <div className="fx ac jb gap12">
                    <div style={{ minWidth: 0 }}>
                      <div className="mono" style={{ fontWeight: 600 }}>{v.code}</div>
                      <div className="fine mt2">
                        {formatPrice(v.amountPaise)}
                        {v.recipientEmail ? ` → ${v.recipientEmail}` : ""}
                      </div>
                    </div>
                    <div className="fx ac gap8" style={{ flex: "none" }}>
                      <span
                        className={v.status === "active" ? "pill sg" : "pill"}
                        style={{ textTransform: "capitalize" }}
                      >
                        {v.status}
                      </span>
                      <button
                        className="qbtn"
                        aria-label="Copy code"
                        onClick={async () => {
                          await navigator.clipboard.writeText(v.code).catch(() => undefined);
                          toast.success("Code copied");
                        }}
                      >
                        <i className="ph-bold ph-copy" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </>
          )}

          {/* Vouchers you redeemed */}
          {redeemed.length > 0 && (
            <>
              <div className="lab mb6 mt6">Vouchers you redeemed</div>
              {redeemed.map((v) => (
                <div key={v.id} className="card mb10">
                  <div className="fx ac jb gap12">
                    <div className="mono" style={{ fontWeight: 600 }}>{v.code}</div>
                    <span className="price safc">+{formatPrice(v.amountPaise)}</span>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
