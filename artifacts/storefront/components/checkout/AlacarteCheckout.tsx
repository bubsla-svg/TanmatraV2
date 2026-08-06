"use client";
// Client: reads the interactive cart and drives the guest money path end to end.
import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useCart } from "@/components/cart/CartProvider";
import { itemCount, type CartState } from "@/lib/cartStore";
import { runAlacarteCheckout, finishAlacartePayment } from "@/lib/moneyPath";
import { createRazorpayAdapter, RazorpayDismissed } from "@/lib/razorpayAdapter";
import {
  ApiError,
  getAddresses,
  type Address,
  type AlacarteOrderInput,
  type AlacarteOrderResponse,
  type AuthUser,
} from "@/lib/api";
import { DPDP_POLICY_VERSION } from "@/lib/consent";
import { PhoneAuth } from "./PhoneAuth";
import { AlacarteDetails, type AlacarteAddress } from "./AlacarteDetails";

/**
 * À-la-carte guest checkout (SF-05 / CUJ-01 tail). Cart → details → Razorpay
 * modal → verify → confirmation. The server prices the order and owns every
 * amount; this sends the cart's item ids plus the collected contact/address —
 * never a price. Optional Firebase sign-in (SF-03) attributes the order and
 * prefills the phone, but the path completes fully as a guest.
 */
export function AlacarteCheckout() {
  const router = useRouter();
  const { cart, hydrated } = useCart();
  // This screen only ever creates a DISH order (POST /orders) — marketplace
  // items ship through their own product-page checkout (payForMarketplace).
  // Scoping the summary/total to dish lines keeps the amount shown here
  // identical to the amount actually billed; a marketplace line silently
  // dropped from the order but still counted in the displayed total would be
  // a real money-integrity bug, not a display nit.
  const dishLines = cart.lines.filter((l) => l.kind === "dish");
  const marketplaceLines = cart.lines.filter((l) => l.kind === "marketplace");
  const dishCart: CartState = { lines: dishLines };
  const [phone, setPhone] = useState("");
  const [phoneLocked, setPhoneLocked] = useState(false);
  const [busy, setBusy] = useState(false);
  // Money captured, verify in flight (with in-place retry — see moneyPath's
  // verifyWithRetry). Distinct from `busy` so the CTA can say what is
  // actually happening to money that has already left the customer's account.
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // SF-04 in-flow: once signed in, a saved default address prefills the form.
  const [savedAddress, setSavedAddress] = useState<Address | null>(null);
  // One idempotency key per checkout session, and the order once created, so a
  // retry after a dismissed modal resumes payment instead of creating a
  // duplicate (the server 409s a reused externalOrderId).
  const idempotencyKey = useRef<string | null>(null);
  const createdOrder = useRef<AlacarteOrderResponse | null>(null);

  function onVerified(user: AuthUser) {
    if (user.phoneE164) {
      setPhone(user.phoneE164.replace(/^\+?91/, ""));
      setPhoneLocked(true);
    }
    // Prefill from the saved default address, if any (SF-04). Best-effort: a
    // failure just leaves the manual form — the guest path never depends on it.
    void getAddresses()
      .then(({ addresses }) => {
        const pick = addresses.find((a) => a.isDefault) ?? addresses[0];
        if (pick) setSavedAddress(pick);
      })
      .catch(() => {});
  }

  async function handlePay(address: AlacarteAddress) {
    if (dishLines.length === 0) return; // defense-in-depth; the button is also gated
    setError(null);
    setBusy(true);
    const contact = `+91${phone.replace(/\D/g, "")}`;
    try {
      let result;
      if (createdOrder.current) {
        // A prior attempt already created this order — pay it, don't re-create.
        result = await finishAlacartePayment(createdOrder.current, createRazorpayAdapter({ contact }), undefined, {
          onVerifying: () => setVerifying(true),
        });
      } else {
        if (!idempotencyKey.current) idempotencyKey.current = `alc-${crypto.randomUUID()}`;
        const order: AlacarteOrderInput = {
          externalOrderId: idempotencyKey.current,
          items: dishLines
            .map((l) => ({
              dishId: l.dishId,
              qty: l.qty,
              ...(l.customizationSelections && l.customizationSelections.length > 0
                ? { customizations: l.customizationSelections }
                : {}),
            })),
          phone: contact,
          address,
          consent: { accepted: true, policyVersion: DPDP_POLICY_VERSION },
        };
        result = await runAlacarteCheckout({
          order,
          razorpay: createRazorpayAdapter({ contact }),
          onCreated: (o) => {
            createdOrder.current = o;
          },
          onVerifying: () => setVerifying(true),
        });
      }
      router.push(`/order/confirmed/${encodeURIComponent(result.orderId)}`);
    } catch (e) {
      if (e instanceof RazorpayDismissed) {
        setError("Payment cancelled — you haven't been charged. Tap Continue to try again.");
      } else {
        setError(e instanceof ApiError ? e.message : "Something went wrong. Please try again.");
      }
      setBusy(false);
      setVerifying(false);
    }
  }

  if (hydrated && itemCount(cart) === 0) {
    return (
      <div className="flex flex-col items-start gap-4">
        <h1 className="text-xl font-semibold text-ink">Your cart is empty</h1>
        <p className="text-sm text-ink-muted">Add a dish or a pantry item and it&rsquo;ll show up here to check out.</p>
        <div className="flex flex-wrap gap-2">
          <Button asChild shape="pill" size="fluid" className="px-6 py-3 font-semibold">
            <Link href="/menu">Browse meals</Link>
          </Button>
          <Button asChild variant="outline" shape="pill" size="fluid" className="bg-surface px-6 py-3 font-semibold">
            <Link href="/marketplace">Browse marketplace</Link>
          </Button>
        </div>
      </div>
    );
  }

  if (hydrated && dishLines.length === 0) {
    return (
      <div className="flex flex-col items-start gap-4">
        <h1 className="text-xl font-semibold text-ink">Your cart only has pantry items</h1>
        <p className="text-sm text-ink-muted">
          Pantry &amp; marketplace items ship separately from meals and aren&rsquo;t part of this checkout — buy them from their own product page.
        </p>
        <Button asChild shape="pill" size="fluid" className="px-6 py-3 font-semibold">
          <Link href="/marketplace">Go to marketplace</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-2xl font-semibold tracking-tight text-ink">Checkout</h1>
      <PhoneAuth onVerified={onVerified} />
      {marketplaceLines.length > 0 && (
        <p role="status" className="rounded-xl border border-line bg-surface-raised px-4 py-3 text-xs text-ink-muted">
          {marketplaceLines.length} pantry {marketplaceLines.length === 1 ? "item" : "items"} in your cart {marketplaceLines.length === 1 ? "isn't" : "aren't"} included in this order — buy {marketplaceLines.length === 1 ? "it" : "them"} separately from the <Link href="/marketplace" className="font-medium text-gold-text hover:underline">marketplace</Link>.
        </p>
      )}
      <AlacarteDetails
        cart={dishCart}
        phone={phone}
        onPhoneChange={setPhone}
        phoneLocked={phoneLocked}
        initialAddress={savedAddress}
        busy={busy}
        verifying={verifying}
        error={error}
        onSubmit={handlePay}
      />
    </div>
  );
}
