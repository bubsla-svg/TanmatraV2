import { skipCutoffCopy, cancellationSnippets, creditExpiryCopy } from "./policy";

export const subscriptionCopy = {
  manage: {
    title: "Manage Subscription",
    skipButton: "Skip Next Delivery",
    pauseButton: "Pause Subscription",
    resumeButton: "Resume Deliveries",
    changePlanButton: "Change Meal Protocol",
    cancelButton: "Cancel Subscription",
  },
  skip: {
    cutoffNotice: skipCutoffCopy,
    pastCutoffError: "Changes after 10:00 PM cutoff cannot apply to tomorrow's delivery.",
    successToast: "Skipped delivery for {date}.",
  },
  pause: {
    title: "Pause Deliveries",
    description: "Temporarily pause deliveries without losing your subscription rate.",
    resumeDateLabel: "Resume Date",
    confirmCta: "Confirm Pause",
  },
  cancellation: {
    beforeCutoffNotice: cancellationSnippets.beforeCutoff,
    afterCutoffNotice: cancellationSnippets.afterCutoff,
    confirmTitle: "Are you sure you want to cancel?",
    confirmDescription: "Cancelling will terminate your recurring subscription at the end of the current billing period.",
  },
  credit: {
    expiryNotice: creditExpiryCopy,
    balance: "Available Meal Credits: {count}",
  },
  banners: {
    paymentFailed: "Payment failed for your latest subscription cycle. Please update your payment details.",
    halted: "Subscription is currently halted due to repeated billing failures.",
  },
} as const;
