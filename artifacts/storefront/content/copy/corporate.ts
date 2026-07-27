import type { CopyLeaf } from "./types";

export const corporateCopy = {
  header: {
    title: "Corporate Wellness & Team Meals",
    subtitle: "Fuel your workforce with healthy, clinical-grade nutrition programs.",
  },
  form: {
    teamSizeLabel: "Team Size",
    companyNameLabel: "Company Name",
    emailLabel: "Work Email",
    submitButton: "Request Partnership Quote",
  },
  // [OWNER] Gate: null until owner confirms SLA days
  slaLeaf: null as CopyLeaf,
} as const;
