import { type Locator, type Page } from "@playwright/test";

/**
 * Page object for the cart drawer.
 *
 * The title is addressed by ROLE, not text, and that is load-bearing: the
 * flag-dark checkout status also contains the string "your cart is saved", and
 * `getByText("Your cart")` is substring- and case-insensitive, so it matches
 * both and resolves to a strict-mode violation. `cuj-01` learned this the hard
 * way and left a comment about it; encoding the fix here means the next spec
 * cannot re-learn it.
 */
export class CartDrawer {
  private readonly page: Page;

  // NOT a parameter property (`constructor(private readonly page: Page)`):
  // Node's strip-only type stripping — which Playwright uses to load these
  // files — rejects those outright with "TypeScript parameter property is
  // not supported in strip-only mode", and the whole suite fails to load.
  constructor(page: Page) {
    this.page = page;
  }

  get root(): Locator {
    return this.page.getByRole("dialog");
  }

  get title(): Locator {
    return this.root.getByRole("heading", { name: "Your cart" });
  }

  line(dishName: string): Locator {
    return this.root.getByText(dishName);
  }

  get subtotal(): Locator {
    return this.root.getByText(/Subtotal \(before delivery & GST\)/);
  }

  /** Present only when the live-checkout flag is built in. Its ABSENCE is the
   *  assertion in a flag-dark build — a CTA into a void is the Pillar 1
   *  defect this whole harness exists to catch. */
  get checkoutLink(): Locator {
    return this.root.getByRole("link", { name: "Checkout" });
  }

  /** The fail-loud status that must appear when checkout is gated. */
  get gatedStatus(): Locator {
    return this.root.getByRole("status");
  }
}
