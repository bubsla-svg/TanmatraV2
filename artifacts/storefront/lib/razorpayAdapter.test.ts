/**
 * SF-05 — the browser Razorpay adapter's contract, tested with a stubbed
 * checkout.js. The invariants that matter to the money path (moneyPath.ts):
 * a successful modal resolves the SERVER's payment ids, and a DISMISSED modal
 * rejects with RazorpayDismissed so runAlacarteCheckout never reaches verify.
 * Run: node --test --import tsx ./lib/razorpayAdapter.test.ts
 */
import test from "node:test";
import assert from "node:assert/strict";
import { createRazorpayAdapter, RazorpayDismissed } from "./razorpayAdapter";

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
  modal: { ondismiss: () => void };
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
