import { createElement, type ComponentPropsWithoutRef, type Ref } from "react";
import { cn } from "@/lib/utils";

/**
 * The one horizontal rail (PR-11b — brief CUJ 2 §2). Eight surfaces used to
 * hand-roll `overflow-x-auto` scrollers with their own snap, bleed and
 * scrollbar rules; this is the container they now share. It is the scroll
 * container only — the children (cards, chips, tabs) keep their own markup,
 * widths and `snap-*` alignment, so an `<ul>` rail is still `ul > li`.
 *
 *  - `snap`  — "start" for browsing cards, "center" for a hero-sized peek,
 *              "none" for chip/tab strips that are read, not paged.
 *  - `bleed` — negative gutter so the rail scrolls edge to edge while its
 *              first item still aligns with the page content.
 *  - the continuation cue: the trailing edge fades (`.rail-fade`,
 *              app/globals.css) so a cut-off item reads as "more this way"
 *              rather than as broken — the affordance `no-scrollbar` removed.
 *
 * Never nest a rail inside a rail.
 */
export type RailProps = ComponentPropsWithoutRef<"div"> & {
  as?: "div" | "ul" | "nav";
  snap?: "start" | "center" | "none";
  bleed?: "gutter" | "4" | "none";
  /** Trailing-edge fade as the continuation cue. */
  fade?: boolean;
  /** React 19 ref-as-prop (no forwardRef, so the rail stays usable from server components). */
  ref?: Ref<HTMLElement>;
};

export function Rail({ as = "div", snap = "start", bleed = "none", fade = true, className, children, ref, ...rest }: RailProps) {
  return createElement(
    as,
    {
      ref,
      className: cn(
        "no-scrollbar flex overflow-x-auto",
        snap !== "none" && "snap-x snap-mandatory",
        bleed === "gutter" && "-mx-gutter px-gutter",
        bleed === "4" && "-mx-4 px-4",
        fade && "rail-fade",
        className,
      ),
      ...rest,
    },
    children,
  );
}
