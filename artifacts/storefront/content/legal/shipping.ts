import type { LegalDoc } from "./types";
import { COMPANY as C } from "./company";

/**
 * Shipping & Delivery Policy. Perishable-food delivery within serviceable
 * areas/time windows; food-safety-in-transit and failed-delivery handling.
 */
export const shippingDoc: LegalDoc = {
  slug: "shipping",
  title: "Shipping & Delivery Policy",
  summary:
    "Where and when Tanmatra delivers, how your meals are kept safe in transit, and what happens if a delivery is delayed or missed.",
  updated: C.updated,
  sections: [
    {
      heading: "1. Where we deliver",
      body: [
        `We currently deliver within ${C.serviceAreas}. Serviceability is checked from your delivery pincode at checkout; if we don't yet serve your area, the Platform will let you know.`,
      ],
    },
    {
      heading: "2. Delivery windows and scheduling",
      body: [
        "Meals are delivered within the time windows shown for your plan or order at the time you place it. We aim to deliver within your chosen window, but exact timing can vary with route, traffic, and weather.",
      ],
    },
    {
      heading: "3. Delivery charges",
      body: [
        "Any applicable delivery charge is shown before you confirm your order or plan. Where delivery is included in a plan, that is stated on the plan.",
      ],
    },
    {
      heading: "4. Receiving your order",
      body: [
        "Please provide an accurate address and landmark, keep your phone reachable, and be available to receive your meal within the delivery window. Because the food is perishable, our rider may make a limited number of attempts or wait only briefly before moving on.",
      ],
    },
    {
      heading: "5. Food safety in transit",
      body: [
        "We pack and transport meals to maintain food safety and quality, and dispatch food with adequate remaining shelf life. Once delivered, please refrigerate or consume the meal as advised on the packaging.",
      ],
    },
    {
      heading: "6. Missed or failed deliveries",
      body: [
        "If we cannot complete a delivery because of an incorrect address, an unreachable phone, or no one being available to receive it, the meal may be treated as delivered and may not be eligible for a refund, as it is perishable. If a delivery fails for reasons attributable to us, we will credit or refund it (see the Refund & Cancellation Policy).",
      ],
    },
    {
      heading: "7. Delays and force majeure",
      body: [
        "Deliveries may be delayed or paused by events beyond our reasonable control — such as severe weather, road or civic disruptions, strikes, or emergencies. We will try to notify you and, where a delivery is materially affected, offer a credit or refund as appropriate.",
      ],
    },
    {
      heading: "8. Contact",
      body: [
        `Questions about a delivery? Message us on WhatsApp at ${C.supportPhone}, or email ${C.supportEmail}.`,
      ],
    },
  ],
};
