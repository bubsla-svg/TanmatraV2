import type { LegalDoc } from "./types";
import { COMPANY as C } from "./company";

/**
 * Refund & Cancellation Policy. Framed around perishable, freshly-prepared food
 * and a subscription model with per-delivery cut-offs; refunds route back via
 * Razorpay per RBI timelines or to the account credit ledger.
 */
export const refundsDoc: LegalDoc = {
  slug: "refunds",
  title: "Refund & Cancellation Policy",
  summary:
    "How cancellations, skips, and refunds work for Tanmatra subscriptions and orders — including the cut-offs that apply to freshly prepared, perishable meals.",
  updated: C.updated,
  sections: [
    {
      heading: "1. The short version",
      body: [
        "Our meals are cooked fresh and are perishable, so cancellations depend on timing. You can cancel or change anything before its cut-off at no charge. Once a meal is in preparation or dispatched, it generally can't be cancelled — but if something is wrong with your order, we'll make it right.",
      ],
    },
    {
      heading: "2. Cancelling a subscription",
      body: [
        "You can cancel your subscription at any time from your account. Cancellation stops billing for future cycles. Deliveries already prepared or dispatched, and amounts already charged for them, are not automatically refunded. Any upcoming delivery that has not passed its cut-off can be skipped so you are not charged for it.",
      ],
    },
    {
      heading: "3. Skipping or pausing a delivery",
      body: [
        "You can skip or pause an upcoming delivery before its cut-off. When you skip in time, you are not charged for that delivery, or you receive an account credit if it was already paid within a plan. After the cut-off, the delivery is already being prepared and cannot be skipped.",
      ],
    },
    {
      heading: "4. Free trials and introductory offers",
      body: [
        "Where a trial or introductory offer is available, you can cancel before the stated cut-off to avoid converting to a paid plan. If you don't cancel in time, the plan continues on its normal terms.",
      ],
    },
    {
      heading: "5. Individual (à la carte) orders",
      body: [
        "A one-off order can be cancelled before it enters preparation/dispatch. Once it is being prepared or is out for delivery, it cannot be cancelled because the food is perishable.",
      ],
    },
    {
      heading: "6. Something wrong with your order",
      body: [
        "If an item is missing, incorrect, or not of acceptable quality, tell us as soon as possible — ideally on the day of delivery — with your order details and a photo where relevant. After a quick check, we will offer a suitable remedy: a replacement, an account credit, or a refund.",
      ],
    },
    {
      heading: "7. Failed or missed deliveries",
      body: [
        "If a delivery fails for reasons attributable to us, we will credit or refund it. If it fails because of incorrect address details, unavailability to receive perishable food, or repeated unsuccessful attempts, we may not be able to refund it. See the Shipping & Delivery Policy.",
      ],
    },
    {
      heading: "8. How refunds are made",
      body: [
        "Approved refunds are issued either as account credit or back to your original payment method through our payment partner (Razorpay). Bank/UPI refunds are processed in line with Reserve Bank of India guidelines and typically reach you within about 5–7 business days, depending on your bank. We do not charge a cancellation fee where a cancellation is permitted under this policy.",
      ],
    },
    {
      heading: "9. How to request a cancellation or refund",
      body: [
        `Manage skips, changes, and cancellations from your account. For a refund or a problem with an order, contact ${C.supportEmail} or ${C.supportPhone}, or raise a grievance with our Grievance Officer (${C.grievanceEmail}). See the Grievance Redressal page for timelines.`,
      ],
    },
  ],
};
