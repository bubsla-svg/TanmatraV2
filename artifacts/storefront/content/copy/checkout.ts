import { taxDisclosureCopy, skipCutoffCopy } from "./policy";

export const checkoutCopy = {
  header: {
    title: "Checkout",
    subtitle: "Review your meal selection and confirm delivery details.",
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
  summary: {
    subtotal: "Subtotal",
    tax: "Taxes & Packaging",
    deliveryFee: "Delivery Fee",
    total: "Total Payable",
  },
  placeOrderCta: "Place Order",
  processingPayment: "Verifying payment with bank...",
  paymentFailed: "Payment authorization failed. Please try another card or UPI account.",
} as const;
