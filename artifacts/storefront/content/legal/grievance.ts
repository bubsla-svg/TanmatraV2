import type { LegalDoc } from "./types";
import { COMPANY as C } from "./company";

/**
 * Grievance Redressal. Single named officer for BOTH consumer grievances
 * (Consumer Protection (E-Commerce) Rules, 2020 — acknowledge in 48h, resolve
 * in a month) and data-protection grievances (DPDP Act, escalation to the Data
 * Protection Board). Also the required legal-entity disclosure block.
 */
export const grievanceDoc: LegalDoc = {
  slug: "grievance",
  title: "Grievance Redressal",
  summary:
    "How to raise a complaint with Tanmatra, who handles it, the timelines we follow, and how to escalate — plus our company and registration details.",
  updated: C.updated,
  sections: [
    {
      heading: "1. How to raise a grievance",
      body: [
        `If you have a complaint about an order, a payment, the service, or how we handle your personal data, please contact our Grievance Officer. We handle both consumer and data-protection grievances through this channel.`,
      ],
    },
    {
      heading: "2. Grievance Officer",
      body: [
        `Name: ${C.grievanceOfficer}`,
        `Email: ${C.grievanceEmail}`,
        `Phone: ${C.supportPhone}`,
        `On behalf of: ${C.legalName}`,
        `Address: ${C.registeredOffice}`,
      ],
    },
    {
      heading: "3. Timelines we follow",
      body: [
        "In line with the Consumer Protection (E-Commerce) Rules, 2020, we will acknowledge your grievance within 48 hours of receiving it and endeavour to resolve it within one month. For grievances about your personal data, we respond within the timelines required under the Digital Personal Data Protection Act, 2023.",
      ],
    },
    {
      heading: "4. What to include",
      body: [
        "To help us resolve your grievance quickly, please include your registered mobile number or email, the relevant order or subscription details, a clear description of the issue, and any supporting information such as photos.",
      ],
    },
    {
      heading: "5. Escalation",
      body: [
        "If you are not satisfied with the resolution of a data-protection grievance, you may escalate it to the Data Protection Board of India under the DPDP Act. For consumer grievances, you may also approach the National Consumer Helpline (1915) or the appropriate consumer forum.",
      ],
    },
    {
      heading: "6. Company and registration details",
      body: [
        `Legal name: ${C.legalName}`,
        `Brand: ${C.brand}`,
        `FSSAI Registration No.: ${C.fssaiLicenseNo}`,
        `CIN: ${C.cin}`,
        `Registered office: ${C.registeredOffice}`,
        `Support: ${C.supportEmail} · ${C.supportPhone}`,
      ],
    },
  ],
};
