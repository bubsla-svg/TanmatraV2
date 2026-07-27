import { statusLabels } from "./statusLabels";

export const trackingCopy = {
  header: {
    title: "Order Status",
    subtitle: "Track your meal from kitchen preparation to final delivery.",
  },
  labels: statusLabels,
  etaLabel: "Estimated Arrival",
  etaMinutes: "{minutes} mins",
  riderNotice: "Your rider will contact you upon arrival.",
  supportCta: "Need help with this delivery?",
} as const;
