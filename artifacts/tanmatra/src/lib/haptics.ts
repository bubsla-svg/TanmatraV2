/**
 * Web haptic feedback — the browser-side companion to the native app's
 * `expo-haptics`. Gives key confirmation moments (add-to-cart, payment
 * success, validation error) a physical tick so the web funnel feels as
 * responsive as the mobile one.
 *
 * Honest scope: the Web Vibration API (`navigator.vibrate`) is supported on
 * Android Chromium/Firefox only. iOS Safari exposes NO vibration API to web
 * pages — there is no way to reach the Taptic engine from a browser — so on
 * iOS these calls are silent no-ops by design, not a bug. Every call is
 * feature-detected and wrapped so an unsupported or permission-blocked
 * environment never throws.
 *
 * Motion sensitivity: there is no standard "prefers-reduced-haptics" query,
 * but vibration is a motion-adjacent sensory effect, so we suppress it when
 * the user has asked for reduced motion — the conservative, accessible
 * default. Callers never need to check this themselves.
 */

type VibratePattern = number | number[];

function canVibrate(): boolean {
  return (
    typeof navigator !== "undefined" &&
    typeof navigator.vibrate === "function"
  );
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

function fire(pattern: VibratePattern): void {
  if (!canVibrate() || prefersReducedMotion()) return;
  try {
    navigator.vibrate(pattern);
  } catch {
    // Some engines throw when called outside a user gesture or when the
    // device has vibration disabled — a silent tick is a non-event.
  }
}

/** A single light tick — selections, toggles, adding one item. */
export function hapticLight(): void {
  fire(10);
}

/** A crisp double-tap — a committed success (payment captured, order placed). */
export function hapticSuccess(): void {
  fire([12, 40, 24]);
}

/** A firmer pulse — a soft warning (item removed, limit reached). */
export function hapticWarning(): void {
  fire([20, 60, 20]);
}

/** A triple buzz — a hard error (payment failed, validation blocked). */
export function hapticError(): void {
  fire([30, 40, 30, 40, 30]);
}
