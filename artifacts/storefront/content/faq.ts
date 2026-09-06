/**
 * FAQ content — ported verbatim from the legacy app (artifacts/tanmatra
 * tanmatra-v2/Faq.tsx) as part of Wave A of the route-parity port. Kept as data
 * so the page + accordion .tsx stay under the component cap and the same list
 * feeds the FAQPage JSON-LD.
 *
 * NOTE for review: the refund answer's window ("within 30 minutes") is the
 * legacy copy and should be reconciled with the canonical Refund & Cancellation
 * policy (/legal/refunds), which frames refunds around perishable cut-offs.
 */
export interface FaqItem {
  q: string;
  a: string;
}

export const FAQS: FaqItem[] = [
  {
    q: "What's different about Tanmatra food?",
    a: "Every dish is cooked fresh after you order in our FSSAI-registered kitchen, with the calories and protein on the label. Cold-pressed oils and desi ghee, no refined sugar, no preservatives or artificial flavours. It's good everyday food, not medical advice.",
  },
  {
    q: "Can I order if I'm managing a health condition (diabetes, hypertension, IBS)?",
    a: "Yes. Plans like Steady are built around low-GI, no-refined-sugar plates, and every dish lists its calories and protein. It's everyday food, not a treatment — if you're managing a condition or taking medication, check with your doctor before changing your diet.",
  },
  {
    q: "How do I check if Tanmatra delivers to my area?",
    a: "Enter your pincode on the home or checkout page. Delivery is currently available across Noida; we are expanding regularly. If your area is not yet served, you can join the waitlist.",
  },
  {
    q: "What are the delivery timings?",
    a: "Meals are cooked after you order and delivered the same day. The exact delivery window is shown at checkout, based on your address.",
  },
  {
    q: "How do plans and billing work?",
    a: "Weekly and monthly plans let you pre-select meals at a better rate, and renew by UPI Autopay until you cancel — we message you before every charge. Skip, swap or pause from the Subscriptions page up to a day before. There's no lock-in.",
  },
  {
    q: "What payment methods do you accept?",
    a: "We accept all major UPI apps (Google Pay, PhonePe, Paytm), debit/credit cards, net banking, popular wallets, and cash on delivery. Payments are processed securely via Razorpay (PCI-DSS Level 1 certified). Tanmatra never sees or stores your card or UPI credentials.",
  },
  {
    q: "Do I need an account to order?",
    a: "Browsing the menu and checking prices does not require an account. An account is needed to place an order so we can track delivery and order history for you. Sign-up takes under 60 seconds.",
  },
  {
    q: "What is your refund and cancellation policy?",
    a: "Orders can be cancelled within 30 minutes of placement for a full refund. After that, cancellations are assessed case-by-case. Meals that arrive damaged or incorrect are replaced or refunded — contact us via the Support tab within 2 hours of delivery.",
  },
  {
    q: "Are the meals suitable for vegans / vegetarians?",
    a: "The menu is clearly tagged: Vegan, Vegetarian, Egg, Poultry, Seafood, and Meat. You can filter by dietary preference on the Menu page. All meals are prepared in a shared kitchen, so cross-contact between ingredients is possible — we flag allergens on every dish so you can make an informed choice. If you have a severe allergy, please contact support before ordering.",
  },
];
