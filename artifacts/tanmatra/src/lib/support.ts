// Single source of truth for customer-support contact points.
// Update here and every surface (footer, checkout help, noscript fallback)
// follows.

export const WHATSAPP_NUMBER_E164 = "919289213115";
export const WHATSAPP_DISPLAY = "+91 92892 13115";

/** wa.me deep link with an optional prefilled message. */
export function whatsappLink(message?: string): string {
  const base = `https://wa.me/${WHATSAPP_NUMBER_E164}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}

export const SUPPORT_EMAIL = "care@tanmatra.health";
