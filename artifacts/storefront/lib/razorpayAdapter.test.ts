/**
 * SF-05 — the browser Razorpay adapter's contract, tested with a stubbed
 * checkout.js. The invariants that matter to the money path (moneyPath.ts):
 * a successful modal resolves the SERVER's payment ids, and a DISMISSED modal
 * rejects with RazorpayDismissed so runAlacarteCheckout never reaches verify.
 * Run: node --test --import tsx ./lib/razorpayAdapter.test.ts
 */
import test from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import {
  buildRazorpayOptions,
  createRazorpayAdapter,
  RazorpayDismissed,
  RAZORPAY_DISPLAY_CONFIG,
} from "./razorpayAdapter";
import { ACCENT_GOLD_LIGHT } from "./themes/brand";

interface RzpOpts {
  key: string;
  amount: number;
  currency: string;
  order_id: string;
  handler: (r: {
    razorpay_payment_id: string;
    razorpay_order_id: string;
    razorpay_signature: string;
  }) => void;
  modal: { ondismiss: () => void; confirm_close?: boolean };
}

const ORDER = { razorpayOrderId: "rzp_1", amount: 41800, currency: "INR", keyId: "key_x" };

/** Run `body` with checkout.js stubbed to either pay or dismiss on open(). */
async function withStubbedRazorpay(
  behaviour: "pay" | "dismiss",
  body: () => Promise<void>,
): Promise<void> {
  const g = globalThis as Record<string, unknown>;
  const prevWindow = g.window;
  const prevDocument = g.document;
  class FakeRazorpay {
    private opts: RzpOpts;
    constructor(opts: RzpOpts) {
      this.opts = opts;
    }
    open(): void {
      if (behaviour === "dismiss") {
        this.opts.modal.ondismiss();
      } else {
        this.opts.handler({
          razorpay_payment_id: "pay_1",
          razorpay_order_id: this.opts.order_id,
          razorpay_signature: "sig_1",
        });
      }
    }
  }
  // getElementById truthy → loadCheckoutScript treats the script as present and
  // resolves without touching the DOM (no real injection under test).
  g.document = { getElementById: () => ({}) };
  g.window = { Razorpay: FakeRazorpay };
  try {
    await body();
  } finally {
    g.window = prevWindow;
    g.document = prevDocument;
  }
}

test("resolves with the mapped payment ids when the modal succeeds", async () => {
  await withStubbedRazorpay("pay", async () => {
    const paid = await createRazorpayAdapter().open(ORDER);
    assert.deepEqual(paid, {
      razorpayPaymentId: "pay_1",
      razorpayOrderId: "rzp_1",
      razorpaySignature: "sig_1",
    });
  });
});

test("rejects with RazorpayDismissed when the modal is dismissed", async () => {
  await withStubbedRazorpay("dismiss", async () => {
    await assert.rejects(
      createRazorpayAdapter().open(ORDER),
      (err) => err instanceof RazorpayDismissed && /payment_dismissed/.test((err as Error).message),
    );
  });
});

// ── The modal's UX configuration (buildRazorpayOptions) ──────────────────────

test("the modal is configured from the SERVER order, verbatim", () => {
  const o = buildRazorpayOptions(ORDER);
  assert.equal(o.key, ORDER.keyId);
  assert.equal(o.amount, ORDER.amount);
  assert.equal(o.currency, ORDER.currency);
  assert.equal(o.order_id, ORDER.razorpayOrderId);
  assert.equal(o.config, RAZORPAY_DISPLAY_CONFIG);
});

test("prefill carries what the checkout already knows — never re-ask for it", () => {
  const o = buildRazorpayOptions(ORDER, { contact: "+919999999999", email: "a@b.in" });
  assert.equal(o.prefill.contact, "+919999999999");
  assert.equal(o.prefill.email, "a@b.in");
  // And degrades to empty strings, never undefined, when a surface has none.
  const bare = buildRazorpayOptions(ORDER);
  assert.deepEqual(bare.prefill, { contact: "", email: "" });
});

test("the modal theme is the LIGHT-arm brand gold, never the dark-arm value", () => {
  // The modal is a Razorpay-hosted LIGHT sheet that sets white text over
  // theme.color. The dark-arm gold #D4AF37 measures ~2:1 under white — the
  // light arm is the one that carries white ink on our own surfaces too
  // (--color-accent-ink light = #ffffff). See lib/themes/brand.ts.
  const o = buildRazorpayOptions(ORDER);
  assert.equal(o.theme.color, ACCENT_GOLD_LIGHT);
  assert.notEqual(o.theme.color.toUpperCase(), "#D4AF37");
});

test("brand.ts's restated gold cannot drift from tanmatraTheme's accent tuple", () => {
  // tanmatraTheme.ts must keep its tuples literal (astryxBridge.test.ts
  // parses the source), so brand.ts RESTATES the light arm rather than
  // feeding it. This is the drift pin, by the same source-parsing technique:
  // the day someone repoints --color-accent's light arm, this fails and
  // names brand.ts as the second site to update.
  const src = fs.readFileSync(new URL("./themes/tanmatraTheme.ts", import.meta.url), "utf8");
  const m = src.match(/'--color-accent':\s*\[\s*'([^']+)'/);
  assert.ok(m, "--color-accent tuple not found in tanmatraTheme.ts");
  assert.equal(m![1]!.toUpperCase(), ACCENT_GOLD_LIGHT.toUpperCase());
});

test("send_sms_hash is on, so Android can auto-read the card OTP", () => {
  assert.equal(buildRazorpayOptions(ORDER).send_sms_hash, true);
});

test("every configured option actually reaches the Razorpay constructor", async () => {
  // Captured from the REAL constructor call. The buildRazorpayOptions tests
  // above pin the pure function; this pins the wiring — without it, inlining
  // the constructor body (say, in a bad merge-conflict resolution) would keep
  // every pure-function test green while the live modal silently lost the
  // theme, prefill, send_sms_hash and the UPI-first config.
  let captured: (RzpOpts & Record<string, unknown>) | undefined;
  const g = globalThis as Record<string, unknown>;
  const prevWindow = g.window;
  const prevDocument = g.document;
  class CapturingRazorpay {
    constructor(opts: RzpOpts & Record<string, unknown>) {
      captured = opts;
    }
    open(): void {
      captured!.modal.ondismiss();
    }
  }
  g.document = { getElementById: () => ({}) };
  g.window = { Razorpay: CapturingRazorpay };
  try {
    await assert.rejects(
      createRazorpayAdapter({ contact: "+919999999999", email: "a@b.in" }).open(ORDER),
      RazorpayDismissed,
    );
    // The dismissal guard — the one UX flag that rides with the outcome
    // wiring (handler + ondismiss) rather than inside buildRazorpayOptions.
    assert.equal(captured!.modal.confirm_close, true);
    // And the full built bundle, spread into the same constructor call.
    assert.equal(captured!.config, RAZORPAY_DISPLAY_CONFIG);
    assert.deepEqual(captured!.theme, { color: ACCENT_GOLD_LIGHT });
    assert.equal(captured!.send_sms_hash, true);
    assert.deepEqual(captured!.prefill, { contact: "+919999999999", email: "a@b.in" });
    assert.equal(captured!.order_id, ORDER.razorpayOrderId);
    assert.equal(captured!.key, ORDER.keyId);
  } finally {
    g.window = prevWindow;
    g.document = prevDocument;
  }
});

// ── Script-load retry (the 3G brick) ─────────────────────────────────────────
//
// The regression these exist for: one failed checkout.js load left its dead
// <script> tag in the DOM, so every retry short-circuited on the tag's
// existence, resolved, and hit the `!Razorpay` throw — a customer with an
// already-created order and a "Try again" that could never work.

/** A minimal script-element fake: enough DOM for loadCheckoutScript. */
class FakeScriptEl {
  id = "";
  src = "";
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  removed = false;
  private attrs = new Map<string, string>();
  private listeners = new Map<string, Array<() => void>>();
  setAttribute(k: string, v: string): void {
    this.attrs.set(k, v);
  }
  getAttribute(k: string): string | null {
    return this.attrs.get(k) ?? null;
  }
  addEventListener(type: string, fn: () => void): void {
    const list = this.listeners.get(type) ?? [];
    list.push(fn);
    this.listeners.set(type, list);
  }
  dispatch(type: "load" | "error"): void {
    if (type === "load") this.onload?.();
    else this.onerror?.();
    for (const fn of this.listeners.get(type) ?? []) fn();
    this.listeners.set(type, []);
  }
  remove(): void {
    this.removed = true;
  }
}

/** A document fake where injected scripts are held for the test to settle. */
function fakeDom(behaviour: { withRazorpay?: boolean } = {}) {
  const injected: FakeScriptEl[] = [];
  const g = globalThis as Record<string, unknown>;
  const prevWindow = g.window;
  const prevDocument = g.document;
  g.window = behaviour.withRazorpay
    ? {
        Razorpay: class {
          open(): void {
            /* never reached in these tests */
          }
        },
      }
    : {};
  g.document = {
    getElementById: (id: string) => injected.find((s) => s.id === id && !s.removed) ?? null,
    createElement: () => new FakeScriptEl(),
    head: {
      appendChild: (s: FakeScriptEl) => {
        injected.push(s);
      },
    },
  };
  return {
    injected,
    restore() {
      g.window = prevWindow;
      g.document = prevDocument;
    },
  };
}

test("a failed script load removes its tag, so the NEXT attempt re-injects and can succeed", async () => {
  const dom = fakeDom();
  try {
    // Attempt 1: the load dies (3G drop). Must reject, and must clean up.
    const first = createRazorpayAdapter().open(ORDER);
    assert.equal(dom.injected.length, 1);
    dom.injected[0]!.dispatch("error");
    await assert.rejects(first, /razorpay_script_unavailable/);
    assert.equal(dom.injected[0]!.removed, true);

    // Attempt 2: the tag is gone, so a fresh one is injected — the retry is
    // ALIVE. (Pre-fix: the dead tag short-circuited to resolve() and open()
    // threw razorpay_unavailable forever.)
    const second = createRazorpayAdapter().open(ORDER);
    assert.equal(dom.injected.length, 2, "second attempt must inject a fresh script tag");
    dom.injected[1]!.dispatch("error"); // settle it; the injection is the assertion
    await assert.rejects(second, /razorpay_script_unavailable/);
  } finally {
    dom.restore();
  }
});

test("a concurrent open() piggybacks on the in-flight tag instead of double-injecting", async () => {
  const dom = fakeDom();
  try {
    const first = createRazorpayAdapter().open(ORDER);
    const second = createRazorpayAdapter().open(ORDER);
    assert.equal(dom.injected.length, 1, "one tag serves both callers");
    dom.injected[0]!.dispatch("error");
    await assert.rejects(first, /razorpay_script_unavailable/);
    await assert.rejects(second, /razorpay_script_unavailable/);
  } finally {
    dom.restore();
  }
});

test("script loaded but library broken fails LOUD (razorpay_unavailable), it does not hang", async () => {
  const dom = fakeDom(); // window.Razorpay stays undefined even after "load"
  try {
    const attempt = createRazorpayAdapter().open(ORDER);
    dom.injected[0]!.dispatch("load"); // script ran, marker set, global never appeared
    await assert.rejects(attempt, /razorpay_unavailable/);

    // And the next attempt sees the loaded marker → same LOUD failure, no hang.
    await assert.rejects(createRazorpayAdapter().open(ORDER), /razorpay_unavailable/);
  } finally {
    dom.restore();
  }
});

test("UPI is ordered first without hiding any other method", () => {
  // Plan correction #4: the audits asked for Apple Pay / Google Pay and a
  // second PSP — US advice. In this market the fix is to order UPI first
  // INSIDE the existing single-PSP sheet.
  const { display } = RAZORPAY_DISPLAY_CONFIG;
  assert.deepEqual(display.sequence, ["block.upi"]);
  assert.equal(display.blocks.upi.instruments[0].method, "upi");

  // The half that matters most. Without show_default_blocks the sequence
  // becomes an ALLOW-LIST and cards, netbanking and wallets vanish from
  // checkout — turning a preference into the removal of someone's only
  // working payment method.
  assert.equal(
    display.preferences.show_default_blocks,
    true,
    "every other method must still be offered below UPI",
  );
});

test("the adapter actually passes the ordering to Razorpay", () => {
  // Since the buildRazorpayOptions extraction, `config: RAZORPAY_DISPLAY_CONFIG`
  // appears inside the BUILDER, so grepping for it would prove declaration,
  // not passing — the exact thing this test's failure message disclaims. The
  // constructor-capture test above is the real proof; this grep now pins the
  // one line that connects the two (the spread inside `new Razorpay(...)`).
  const src = fs.readFileSync(new URL("./razorpayAdapter.ts", import.meta.url), "utf8");
  assert.match(src, /\.\.\.buildRazorpayOptions\(order, opts\)/, "the constructor must spread the built options");
});
