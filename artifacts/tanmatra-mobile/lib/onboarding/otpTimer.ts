/**
 * Pure resend-countdown state for the OTP step. No timers, no React — the UI
 * ticks it once a second and reads `canResend`/`secondsLeft`. Unit-testable.
 */

export const RESEND_COOLDOWN_SECONDS = 45;

export interface ResendState {
  secondsLeft: number;
}

export function startResend(
  seconds: number = RESEND_COOLDOWN_SECONDS,
): ResendState {
  return { secondsLeft: Math.max(0, Math.floor(seconds)) };
}

/** Advance the countdown by one second (never below zero). Returns a new state. */
export function tickResend(state: ResendState): ResendState {
  if (state.secondsLeft <= 0) return state;
  return { secondsLeft: state.secondsLeft - 1 };
}

export function canResend(state: ResendState): boolean {
  return state.secondsLeft <= 0;
}
