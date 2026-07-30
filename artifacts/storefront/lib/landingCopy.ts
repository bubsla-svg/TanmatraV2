/**
 * Landing-copy helpers for the acquisition landers (Stitch briefs 14–20).
 *
 * The Stitch "protocol" treatment renders the step number as its own gold
 * numeral chip beside the card. Some content files already carry the number
 * inside the title ("1 · Set a company budget") because the old layout had
 * nowhere else to put it. Rendering both would double-number the step, so the
 * number is parsed out of the title here rather than in JSX — it is real string
 * logic with edge cases (no prefix, multi-digit, en-dash vs middot), so it is
 * tested instead of inlined.
 */

/** A step's display parts: the numeral chip and the title with its prefix removed. */
export interface StepLabel {
  /** Zero-padded numeral for the chip, e.g. "01". */
  number: string;
  /** Title with any leading "N · " / "N. " / "N) " ordinal stripped. */
  label: string;
}

/** Leading ordinal: digits followed by a separator (middot, en/em dash, dot, colon, paren). */
const ORDINAL_PREFIX = /^\s*(\d{1,2})\s*[·.:)–—-]\s+/;

/**
 * Split a step title into its numeral and its text.
 *
 * The numeral always comes from `index` (the render order is the truth — a
 * content file that numbers its steps 1,2,4 must not render a gap), while the
 * title's own ordinal prefix is stripped so it is not shown twice.
 */
export function stepLabel(title: string, index: number): StepLabel {
  const number = String(index + 1).padStart(2, "0");
  const label = title.replace(ORDINAL_PREFIX, "").trim();
  // A title that is nothing but an ordinal ("3.") would strip to empty; keep the
  // original in that case so the step never renders as a blank row.
  return { number, label: label.length > 0 ? label : title.trim() };
}
