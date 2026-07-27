import { disclaimerDoc } from "../legal/disclaimer";

export const coachCopy = {
  header: {
    title: "AI Clinical Nutrition Coach",
    subtitle: "Ask questions about your meal protocol and metabolic health.",
  },
  disclaimerText: disclaimerDoc.summary || "Disclaimer: Information provided is for educational purposes and not medical advice.",
  refusal: {
    medicalEmergency: "If you are experiencing a medical emergency, please contact emergency services immediately.",
    outOfScope: "I can only assist with nutrition, meal protocols, and dietary preferences.",
  },
} as const;
