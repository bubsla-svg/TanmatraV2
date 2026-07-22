import { cn } from "@/lib/utils";
import { onDishImageError } from "@/lib/imgFallback";

interface RdBadgeProps {
  rdName: string;
  /** e.g. "RD, Clinical Nutrition". */
  credential: string;
  /** Optional real photo (never stock — 02f §4). Falls back to a monogram. */
  photo?: string;
  className?: string;
}

/**
 * `<RdBadge>` — 02f §1 component 6. The trust primitive: a named registered
 * dietitian with a sage "RD Verified" treatment, used on the PDP, plan page,
 * and the RD order-bump. Renders a real photo when given one, else a sage
 * monogram — never a fabricated headshot.
 *
 * Honest-claims note: this asserts the *reviewer* is a named RD; it does not
 * assert a dish carries lab-verified macros (that is `MacroReadout`'s gate).
 */
export function RdBadge({ rdName, credential, photo, className }: RdBadgeProps) {
  const initials = rdName
    .split(/\s+/)
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div
      className={cn("inline-flex items-center gap-2.5 rounded-lg px-2.5 py-1.5", className)}
      style={{ backgroundColor: "var(--color-clinical-sage-light)" }}
    >
      {photo ? (
        <img
          src={photo}
          alt={`${rdName}, ${credential}`}
          onError={onDishImageError}
          width={40}
          height={40}
          style={{ borderRadius: 9999, objectFit: "cover", flex: "none" }}
        />
      ) : (
        <span
          aria-hidden="true"
          style={{
            width: 40,
            height: 40,
            borderRadius: 9999,
            flex: "none",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: 600,
            color: "var(--color-sage-100)",
            backgroundColor: "var(--color-sage-700)",
          }}
        >
          {initials}
        </span>
      )}
      <span className="flex flex-col leading-tight">
        <span className="inline-flex items-center gap-1 text-sm font-semibold">
          {rdName}
          <i
            className="ph-fill ph-seal-check"
            aria-hidden="true"
            style={{ color: "var(--color-clinical-sage)" }}
          />
        </span>
        <span className="text-xs" style={{ color: "var(--color-clinical-sage)" }}>
          {credential} · RD Verified
        </span>
      </span>
    </div>
  );
}
