/**
 * FAQ content — ported verbatim from the legacy app (artifacts/tanmatra
 * tanmatra-v2/Faq.tsx) as part of Wave A of the route-parity port. Kept as data
 * so the page + accordion .tsx stay under the component cap and the same list
 * feeds the FAQPage JSON-LD.
 *
 * NOTE for review: answer #9's refund window ("within 30 minutes") is the
 * legacy copy and should be reconciled with the canonical Refund & Cancellation
 * policy (/legal/refunds), which frames refunds around perishable cut-offs.
 */
export interface FaqItem {
  q: string;
  a: string;
}

export const FAQS: FaqItem[] = [
  {
    q: "What makes Tanmatra meals 'clinical-grade'?",
    a: "Every dish on the Tanmatra menu is formulated by qualified registered dietitians (RDs) and macro-calibrated to specific therapeutic targets — protein, fibre, glycaemic load, sodium, and caloric density. Meals are prepared in an FSSAI-registered kitchen with ISO 22000-aligned processes, without preservatives or artificial flavours. Our meals are designed to support your health goals and any care plan from your doctor — they are not a medical treatment in themselves.",
  },
  {
    q: "Who designs the meal plans?",
    a: "Our in-house team of registered dietitians develops and reviews each recipe. When you book a 1-on-1 consultation, a dedicated RD reviews your health profile and builds a personalised plan tailored to your goals and any therapeutic protocols (Wellness, Performance, or Clinical).",
  },
  {
    q: "Can I order if I have a specific medical condition (diabetes, hypertension, IBS)?",
    a: "Yes. Tanmatra offers condition-specific therapeutic protocols. However, our meals are designed as adjuncts to medical care — they do not replace treatment prescribed by your doctor. Always consult your physician before beginning any therapeutic nutrition programme.",
  },
  {
    q: "How do I check if Tanmatra delivers to my area?",
    a: "Enter your pincode on the home or checkout page. Delivery is currently available across Noida; we are expanding regularly. If your area is not yet served, you can join the waitlist.",
  },
  {
    q: "What are the delivery timings?",
    a: "Fresh meals are dispatched for same-day delivery. Ordering by 10 AM typically ensures delivery by lunch; by 2 PM for dinner. Exact windows are shown at checkout based on your delivery address.",
  },
  {
    q: "Can I subscribe to a weekly meal plan?",
    a: "Yes. Weekly plans let you pre-select meals for the week at a discounted rate. Plans auto-renew unless cancelled at least 24 hours before the next cycle. You can pause, skip, or modify meals from the Subscriptions page.",
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
  {
    q: "What scientific references back Tanmatra's dietary protocols?",
    a: "Our protocols are informed by peer-reviewed clinical guidelines: The Diabetes Protocol aligns with the American Diabetes Association (ADA) Carbohydrate & Glycemic Index recommendations (low-GI < 55). Saturated fat and sodium restrictions align with the American Heart Association (AHA) guidelines for prevention. Our Sports Recovery guidelines are built on the International Society of Sports Nutrition (ISSN) recommendations for post-exercise glycogen and protein synthesis.",
  },
];
