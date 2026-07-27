import { taxDisclosureCopy, skipCutoffCopy } from "./policy";

export const checkoutCopy = {
  header: {
    title: "Checkout",
  },
  disclosure: taxDisclosureCopy,
  cutoffNotice: skipCutoffCopy,
  autopayNotice: "Recurring payments will be debited automatically on your billing cycle. Cancel or pause anytime before cutoff.",
  steps: {
    address: "Delivery Address",
    schedule: "Delivery Slot",
    payment: "Payment Method",
    review: "Review & Order",
  },
  placeOrderCta: "Place Order",
} as const;
