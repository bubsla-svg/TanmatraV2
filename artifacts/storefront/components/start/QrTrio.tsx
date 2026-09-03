import Image from "next/image";
import { formatMacroLine } from "@/lib/format";
import type { TrioDish } from "@/lib/trialTrio";

/**
 * The three dishes, with photography and macros, ABOVE the first ask (Law 1).
 *
 * Server-rendered on purpose. This is the whole proof half of a scan-to-paid
 * landing, and it must be in the first HTML chunk — a cold scanner standing at
 * a poster on a mobile connection should not be waiting on a JS bundle to find
 * out what is in the box. Nothing here is interactive, so nothing here is a
 * client component.
 */
export function QrTrio({ dishes }: { dishes: TrioDish[] }) {
  if (dishes.length === 0) return null;
  return (
    <ul className="grid grid-cols-3 gap-3">
      {dishes.map((dish) => (
        <li
          key={dish.slug}
          className="flex flex-col overflow-hidden rounded-2xl border border-line bg-surface"
        >
          <div className="relative aspect-square w-full overflow-hidden bg-surface-raised">
            {/* `fill` inside the aspect-square box keeps CLS at zero — which
                matters more here than anywhere else in the app, since this is
                the first paint of a cold visit. sizes: three columns inside
                the max-w-md (28rem) px-4 column, two 12px gaps. */}
            <Image
              src={dish.image}
              alt=""
              fill
              sizes="(min-width: 28rem) 131px, calc((100vw - 3.5rem) / 3)"
              className="object-cover"
            />
          </div>
          <div className="flex flex-1 flex-col gap-1 p-2.5 text-center">
            <p className="text-xs font-semibold leading-snug text-ink">{dish.name}</p>
            {dish.macros && (
              <p className="tabular text-[0.6875rem] leading-tight text-ink-faint">
                {formatMacroLine(dish.macros, dish.macrosEstimated)}
              </p>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
