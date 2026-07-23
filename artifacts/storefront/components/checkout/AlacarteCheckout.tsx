"use client";
// Client: reads the interactive cart and drives the guest money path end to end.
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCart } from "@/components/cart/CartProvider";
import { itemCount } from "@/lib/cartStore";
import { runAlacarteCheckout } from "@/lib/moneyPath";
import { createRazorpayAdapter, RazorpayDismissed } from "@/lib/razorpayAdapter";
import { ApiError, type AlacarteOrderInput, type AuthUser } from "@/lib/api";
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
  const [phone, setPhone] = useState("");
  const [phoneLocked, setPhoneLocked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function onVerified(user: AuthUser) {
    if (user.phoneE164) {
      setPhone(user.phoneE164.replace(/^\+?91/, ""));
      setPhoneLocked(true);
    }
  }

  async function handlePay(address: AlacarteAddress) {
    setError(null);
    setBusy(true);
    const order: AlacarteOrderInput = {
      externalOrderId: `alc-${crypto.randomUUID()}`,
      items: cart.lines.map((l) => ({ dishId: l.dishId, qty: l.qty })),
      phone: `+91${phone.replace(/\D/g, "")}`,
      address,
      consent: { accepted: true, policyVersion: DPDP_POLICY_VERSION },
    };
    try {
      const result = await runAlacarteCheckout({
        order,
        razorpay: createRazorpayAdapter({ contact: order.phone }),
      });
      router.push(`/order/confirmed/${encodeURIComponent(result.orderId)}`);
    } catch (e) {
      if (e instanceof RazorpayDismissed) {
        setError("Payment cancelled — you haven't been charged. Tap Continue to try again.");
      } else {
        setError(e instanceof ApiError ? e.message : "Something went wrong. Please try again.");
      }
      setBusy(false);
    }
  }

  if (hydrated && itemCount(cart) === 0) {
    return (
      <div className="flex flex-col items-start gap-4">
        <h1 className="text-xl font-semibold text-ink">Your cart is empty</h1>
        <p className="text-sm text-ink-muted">Add a dish and it&rsquo;ll show up here to check out.</p>
        <Link href="/menu" className="rounded-xl bg-gold px-5 py-3 text-sm font-semibold text-[var(--gold-ink)]">
          Browse the menu
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-lg font-semibold text-ink">Checkout</h1>
      <PhoneAuth onVerified={onVerified} />
      <AlacarteDetails
        cart={cart}
        phone={phone}
        onPhoneChange={setPhone}
        phoneLocked={phoneLocked}
        busy={busy}
        error={error}
        onSubmit={handlePay}
      />
    </div>
  );
}
