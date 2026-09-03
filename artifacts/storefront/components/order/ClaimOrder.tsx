"use client";
// Client: probes the session and attaches this order to it — both need the
// browser's cookie, and the confirmation page itself is a server component.
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { getAuthUser } from "@/lib/api";
import { emitFunnel } from "@/lib/funnel";
import {
  CLAIM_OFFER_COPY,
  CLAIM_SUCCESS_COPY,
  claimCodeOf,
  claimOrder,
  claimRefusalCopy,
  isOnAccount,
} from "@/lib/claimOrder";
import { PhoneAuth } from "@/components/checkout/PhoneAuth";

type State =
  /** Nothing to say — still probing, mid-claim, or deliberately silent. All
   *  three render null, and collapsing them keeps "renders nothing" a single
   *  decision rather than three places that must agree. */
  | { kind: "silent" }
  /** Signed out — the offer, with sign-in inline. */
  | { kind: "offer" }
  | { kind: "saved" }
  | { kind: "refused"; copy: string }
  /** Transport failed. Retryable, and never dressed up as a decision. */
  | { kind: "unavailable" };

/**
 * "Keep this order" (plan item 2.4).
 *
 * Sign-in at checkout is optional, so a guest can pay end to end with
 * `user_id = NULL` on the row — and `/orders/mine` filters on `user_id`, so
 * that order was invisible forever, even to an account created moments later
 * on the same number. This island is the nudge, and lib/claimOrder + the
 * server's claim endpoint are what make it a true one: nothing here converts
 * someone into an account we then hand an empty history.
 *
 * INLINE, NOT A REDIRECT. A confirmation screen is the worst place in the
 * product to bounce someone to /login — they have just paid and the page they
 * would be leaving is the receipt. Same island rule the account surfaces use.
 *
 * QUIET WHEN IT IS ALREADY TRUE. A customer who signed in during checkout owns
 * the order already; the claim answers `already_yours` and this renders
 * nothing. An offer to save something already saved is noise on a screen whose
 * job is to confirm one thing.
 */
export function ClaimOrder({ orderId }: { orderId: string }) {
  const [state, setState] = useState<State>({ kind: "silent" });

  /**
   * `auto` = the claim this island fires by itself on a signed-in mount, as
   * opposed to the one a customer asked for by verifying their number. The two
   * differ only in how much they are allowed to say: an unasked-for call must
   * not narrate itself, and must not report a failure nobody requested.
   */
  const attach = useCallback(
    async (auto: boolean) => {
      setState({ kind: "silent" });
      try {
        const out = await claimOrder(orderId);
        if (isOnAccount(out.code)) {
          if (out.claimed) emitFunnel("order_claimed", { order_id: orderId });
          // An auto-claim answering `already_yours` means the order was never
          // a guest order — the customer signed in during checkout. Saying
          // "saved to your account" there is noise about something that was
          // already true. After a sign-in the same verdict IS the answer to
          // what they just did, so it is shown.
          setState(auto && !out.claimed ? { kind: "silent" } : { kind: "saved" });
          return;
        }
        setState(
          auto ? { kind: "silent" } : { kind: "refused", copy: claimRefusalCopy(out.code) },
        );
      } catch (e) {
        const code = claimCodeOf(e);
        // A 500/502 is a transport failure, not a verdict, and must never
        // render as "this order belongs to another account".
        if (auto) return setState({ kind: "silent" });
        setState(code ? { kind: "refused", copy: claimRefusalCopy(code) } : { kind: "unavailable" });
      }
    },
    [orderId],
  );

  useEffect(() => {
    let live = true;
    void getAuthUser()
      .then(({ user }) => {
        if (!live) return undefined;
        if (user) return attach(true);
        emitFunnel("order_claim_offered", { order_id: orderId });
        setState({ kind: "offer" });
        return undefined;
      })
      // A failed probe means we cannot tell signed-in from signed-out. Showing
      // the offer to someone already signed in is a contradiction on their own
      // receipt, so render nothing rather than guess.
      .catch(() => {
        if (live) setState({ kind: "silent" });
      });
    return () => {
      live = false;
    };
  }, [attach, orderId]);

  if (state.kind === "silent") return null;

  if (state.kind === "saved") {
    return (
      <p className="mt-6 rounded-2xl bg-sage-soft px-4 py-3 text-sm leading-relaxed text-sage-text">
        {CLAIM_SUCCESS_COPY}{" "}
        <Link href="/account/orders" className="font-medium underline underline-offset-4">
          View your orders
        </Link>
      </p>
    );
  }

  if (state.kind === "refused" || state.kind === "unavailable") {
    return (
      <p role="status" className="mt-6 rounded-2xl border border-line px-4 py-3 text-sm leading-relaxed text-ink-muted">
        {state.kind === "refused"
          ? state.copy
          : "We couldn't save this order to an account just now. Your order is unaffected — try again in a moment."}
      </p>
    );
  }

  return (
    <div className="mt-6 rounded-2xl border border-line bg-surface px-4 py-4">
      <p className="text-sm leading-relaxed text-ink-muted">{CLAIM_OFFER_COPY}</p>
      <div className="mt-3">
        <PhoneAuth startExpanded onVerified={() => void attach(false)} />
      </div>
    </div>
  );
}
