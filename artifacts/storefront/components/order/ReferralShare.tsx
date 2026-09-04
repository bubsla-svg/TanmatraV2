"use client";
// Client: reads the caller's own referral code (auth-gated) and renders a
// shareable /r/<code> link. Guests render nothing — see the note below.

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { formatPaise } from "@/lib/format";
import { getMyReferral, type ReferralMe } from "@/lib/referralApi";

/**
 * The last screen of the acquisition loop, and the first of the next one: the
 * customer who just paid gets their OWN link on day one, so a scan becomes a
 * scanner.
 *
 * AUTH-GATED ISLAND, not a redirect (the storefront's standing rule): a guest
 * who checked out without signing in simply sees nothing here. `/referral/me`
 * ALLOCATES a code on first read, so this must never be called speculatively
 * for someone who has no account to attach it to.
 *
 * BOTH AMOUNTS ARE THE SERVER'S (`awards`), for the same reason the landing's
 * referral card takes its figure from the API: this text is a promise about
 * money, and the only number allowed to make it is the one the ledger will
 * honour.
 */
export function ReferralShare() {
  const [data, setData] = useState<ReferralMe | null>(null);
  const [copied, setCopied] = useState(false);
  const [link, setLink] = useState("");

  useEffect(() => {
    let live = true;
    getMyReferral()
      .then((me) => {
        if (!live) return;
        setData(me);
        // Built from the live origin rather than a configured base URL: the
        // link is about to be pasted into someone's WhatsApp, and it has to be
        // the host they are actually on (preview, staging or production) or it
        // sends their friend somewhere that does not exist.
        setLink(`${window.location.origin}/r/${me.code}`);
      })
      // 401 for a guest, or any transport failure. Silent by design — this is
      // a bonus on a confirmation screen, never a reason to show an error on
      // one.
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);

  if (!data || !link) return null;

  async function share() {
    // Web Share opens the OS sheet (WhatsApp first on most Indian Androids),
    // which is where these links actually travel. Clipboard is the fallback,
    // and a denied clipboard is not an error — the link is on screen to copy
    // by hand.
    const text = `Try Tanmatra — you get ${formatPaise(data!.awards.refereePaise)} off your first box: ${link}`;
    // Read through a local alias: narrowing on `"share" in navigator` against
    // the global collapses the remaining type to `never` in the else branch
    // (the DOM lib declares `share` as always present), which then makes the
    // clipboard fallback un-typeable. The capability check still has to be a
    // runtime one — Web Share is genuinely absent on desktop Safari and in
    // non-secure contexts.
    const nav: Partial<Navigator> = navigator;
    try {
      if (typeof nav.share === "function") {
        await nav.share({ text });
        return;
      }
      await nav.clipboard?.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* dismissed sheet or denied clipboard — nothing to report */
    }
  }

  return (
    <div className="mt-6 flex flex-col gap-3 rounded-2xl border border-line bg-surface p-5">
      <div>
        <p className="font-display text-lg font-semibold leading-tight text-primary">
          Give {formatPaise(data.awards.refereePaise)}, get{" "}
          {formatPaise(data.awards.referrerPaise)}
        </p>
        <p className="mt-1 text-xs leading-relaxed text-ink-muted">
          Send this to a friend. They get {formatPaise(data.awards.refereePaise)} off their
          first box, and you get {formatPaise(data.awards.referrerPaise)} once it&rsquo;s
          delivered.
        </p>
      </div>
      <div className="flex items-center gap-2 rounded-xl border border-line px-3 py-2">
        <span className="min-w-0 flex-1 truncate text-xs text-ink-muted">{link}</span>
        <Button
          type="button"
          onClick={() => void share()}
          shape="pill"
          size="fluid"
          className="shrink-0 px-5 py-2 text-sm font-semibold"
        >
          {copied ? "Copied" : "Share"}
        </Button>
      </div>
    </div>
  );
}
