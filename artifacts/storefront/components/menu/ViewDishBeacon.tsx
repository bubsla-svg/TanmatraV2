"use client";
// Client: one fire-and-forget beacon on mount. Rendered by an RSC page, which
// cannot emit a browser-side analytics event itself.

import { useEffect, useRef } from "react";
import { emitFunnel } from "@/lib/funnel";

/**
 * `view_dish` — the funnel step between the menu and the cart, which nothing
 * measured (plan item 1.1 / 3.3's canonical list).
 *
 * Its own component rather than a hook inside the page, because the page is a
 * server component: making it a client component to emit one event would ship
 * the whole dish detail to the browser to buy a single analytics call.
 *
 * `hasPlanOption` rides along because the pair (`view_dish`, `plan_toggle`) is
 * only readable together — a dish with no plan to toggle to can never emit a
 * toggle, and counting those views in the denominator would report the plan
 * option as ignored when it was never offered.
 */
export function ViewDishBeacon({
  dishSlug,
  hasPlanOption,
}: {
  dishSlug: string;
  hasPlanOption: boolean;
}) {
  const sent = useRef(false);
  useEffect(() => {
    if (sent.current) return;
    sent.current = true;
    emitFunnel("view_dish", { dish_id: dishSlug, has_plan_option: hasPlanOption });
  }, [dishSlug, hasPlanOption]);
  return null;
}
