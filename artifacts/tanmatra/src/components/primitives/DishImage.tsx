import { cn } from "@/lib/utils";
import { onDishImageError } from "@/lib/imgFallback";
import { aspectRatioPaddingTop } from "./logic";

interface DishImageProps {
  src: string;
  alt: string;
  /** "W:H", e.g. "16:9", "4:3", "1:1". Reserves space before load (no CLS). */
  ratio?: string;
  /** Above-the-fold hero image → eager + high fetch priority. */
  priority?: boolean;
  className?: string;
}

/**
 * `<DishImage>` — 02f §1 component 4. A fixed-aspect-ratio image box that
 * reserves its dimensions before the photo loads (IMPECCABLE §12/§15 — no
 * layout shift), lazy-loads below the fold, and swaps a broken src for the
 * shared neutral fallback tile rather than a browser broken-image icon.
 */
export function DishImage({ src, alt, ratio = "1:1", priority = false, className }: DishImageProps) {
  return (
    <div
      className={cn("relative w-full overflow-hidden", className)}
      style={{ paddingTop: aspectRatioPaddingTop(ratio), backgroundColor: "var(--color-ink-800)" }}
    >
      <img
        src={src}
        alt={alt}
        onError={onDishImageError}
        loading={priority ? "eager" : "lazy"}
        fetchPriority={priority ? "high" : "auto"}
        decoding="async"
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover",
        }}
      />
    </div>
  );
}
