/** Paise → a GST-inclusive ₹ string with en-IN grouping. Display only — the
 *  server quote is always the source of truth for anything charged. */
export function formatPaise(paise: number): string {
  return "₹" + Math.round(paise / 100).toLocaleString("en-IN");
}
