import { cn } from "@/lib/utils";

/**
 * Skeleton (TNM-UIF-01 §4.1). CLS guardrail: a skeleton must reserve the
 * SAME dimensions as the real element it stands in for — pass explicit sizing.
 * `animate-pulse` is compositor-safe (opacity only).
 */
function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn("animate-pulse rounded-md bg-muted", className)}
      {...props}
    />
  );
}

export { Skeleton };
