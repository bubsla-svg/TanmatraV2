import colors from '@/constants/colors';

/**
 * Resolved colour tokens for the current theme. The palette is dark-first (the
 * app renders on a #050505 canvas), so we return the `dark` token set plus the
 * shared `radius`.
 *
 * Previously this returned a 4-field stub, while `ui.tsx` and `ErrorFallback`
 * read ~15 tokens off it (card, border, radius, cardElevated, primaryForeground,
 * destructiveSoft, …) — every one of those was `undefined` at runtime.
 */
export function useColors() {
  return {...colors.dark, radius: colors.radius};
}
