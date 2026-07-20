import { motion, useReducedMotion, type HTMLMotionProps } from "framer-motion";
import { SPRING } from "@/lib/motion";

/**
 * A `<button>` whose press settles on a spring instead of a linear CSS
 * `active:scale` transition — the same tactile compression the native app
 * gets from its spring-driven `Pressable`. This is the web half of the
 * cross-platform interaction-parity work: primary CTAs should feel the same
 * under the thumb whether the user is on Expo or the browser.
 *
 * `whileTap` is compositor-only (transform), so it stays off the main thread.
 * The scale is suppressed entirely under `prefers-reduced-motion` — a spring
 * is motion, and a user who opted out gets the plain button with no visual
 * kickback (the click still works, it just doesn't animate).
 *
 * Haptics are deliberately NOT fired here: a press is not a confirmation.
 * Vibration belongs at the semantic success/error moment (see lib/haptics),
 * not on every tap, or it becomes noise.
 */

type TapScaleProps = HTMLMotionProps<"button"> & {
  /** Compression at full press. 0.96 reads as a firm, un-mushy tap. */
  pressScale?: number;
};

export function TapScale({
  pressScale = 0.96,
  children,
  ...props
}: TapScaleProps) {
  const reduce = useReducedMotion();
  return (
    <motion.button
      whileTap={reduce ? undefined : { scale: pressScale }}
      transition={SPRING.snappy}
      {...props}
    >
      {children}
    </motion.button>
  );
}
