"use client";
// Client: `asChild` uses radix-ui's Slot (React context), and Button is the
// hydrated action island (add-to-cart, qty stepper) per TNM-UIF-01 §7.

import * as React from "react";
import { Slot } from "radix-ui";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/**
 * Button (TNM-UIF-01 §4). Token-only: the `default` variant is saffron
 * (--primary, the sole action colour); `secondary`/`outline`/`ghost` are quiet
 * neutrals — never a rival hue; `destructive` is errors-only. Focus ring is the
 * saffron `ring-ring`. No raw colours, no `dark:` forks.
 *
 * `shape` and `size="fluid"` exist so a hand-tuned money-path CTA (its own
 * px-N/py-N, its own rounded-full) can adopt this primitive via `asChild`
 * without a forced layout change: pass the real padding/radius in
 * `className` (cn()'s twMerge resolves the conflict with the CVA default in
 * favour of the later class), keep everything else — focus ring, disabled
 * state, Slot support — from the shared base. `fluid` drops the fixed `h-N`
 * the other sizes bake in, since these buttons size off their own padding,
 * not a fixed row height.
 */
const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap text-sm font-medium outline-none transition-all active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background aria-invalid:ring-2 aria-invalid:ring-destructive [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground shadow-sm hover:bg-primary/90",
        secondary:
          "border border-border bg-secondary text-secondary-foreground hover:bg-accent",
        outline:
          "border border-border bg-background text-foreground hover:bg-accent hover:text-accent-foreground",
        ghost: "text-foreground hover:bg-accent hover:text-accent-foreground",
        destructive:
          "bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2 has-[>svg]:px-3",
        sm: "h-9 px-3",
        lg: "h-11 px-6",
        icon: "size-10",
        fluid: "h-auto",
      },
      shape: {
        default: "rounded-md",
        pill: "rounded-full",
        xl: "rounded-xl",
      },
    },
    defaultVariants: { variant: "default", size: "default", shape: "default" },
  },
);

function Button({
  className,
  variant,
  size,
  shape,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "button";
  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, shape, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
