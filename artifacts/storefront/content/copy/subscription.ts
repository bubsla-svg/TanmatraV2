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
  },
  cancellation: {
    beforeCutoffNotice: cancellationSnippets.beforeCutoff,
    afterCutoffNotice: cancellationSnippets.afterCutoff,
  },
  credit: {
    expiryNotice: creditExpiryCopy,
  },
  banners: {
    paymentFailed: "Payment failed for your latest subscription cycle. Please update your payment details.",
    halted: "Subscription is currently halted due to repeated billing failures.",
  },
} as const;
