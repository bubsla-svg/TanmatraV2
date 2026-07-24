/**
 * Shape of a legal document rendered at /legal/[slug]. Copy lives in data
 * modules (privacy.ts, terms.ts, …) so the page/component .tsx files stay well
 * under the 150-line component cap and the text is reviewable in one place.
 */
export interface LegalSection {
  /** Section heading (rendered as <h2>). */
  heading: string;
  /** Prose paragraphs. */
  body?: string[];
  /** Optional bullet list rendered after the prose. */
  bullets?: string[];
}

export interface LegalDoc {
  /** URL slug under /legal/. */
  slug: string;
  /** Page <h1> + <title>. */
  title: string;
  /** One-line summary for the /legal index + meta description. */
  summary: string;
  /** Human "Last updated" label. */
  updated: string;
  sections: LegalSection[];
}
