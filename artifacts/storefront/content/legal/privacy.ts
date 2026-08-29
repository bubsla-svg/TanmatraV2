import type { LegalDoc } from "./types";
import { COMPANY as C } from "./company";

/**
 * Privacy Policy — drafted against the Digital Personal Data Protection Act,
 * 2023 and the DPDP Rules, 2025 (notified 14 Nov 2025). Data fiduciary is the
 * operating company; personalisation, the AI coach, and clinical/dietary data
 * are called out because they are the sensitive surfaces.
 */
export const privacyDoc: LegalDoc = {
  slug: "privacy",
  title: "Privacy Policy",
  summary:
    "How Trending Media Service Private Limited collects, uses, shares, and protects your personal data on Tanmatra, and the rights you have under India's data-protection law.",
  updated: C.updated,
  sections: [
    {
      heading: "1. Who we are",
      body: [
        `${C.brand} is operated, and its app and data managed, by ${C.legalName} ("we", "us", "our"), the data fiduciary responsible for your personal data under the Digital Personal Data Protection Act, 2023 (the "DPDP Act") and the rules made under it.`,
        `Registered office: ${C.registeredOffice}. FSSAI Registration No. ${C.fssaiLicenseNo}. For any privacy question or to exercise your rights, contact us at ${C.privacyEmail} or reach our Grievance Officer (see the "Grievance" section).`,
      ],
    },
    {
      heading: "2. Scope and your consent",
      body: [
        `This policy applies to personal data we process when you use ${C.brand} — our website, apps, ordering and subscription services, the nutrition coach, and dietitian bookings.`,
        "By creating an account and using the service you consent to the processing described here. Your consent is specific to the purposes below, and you can withdraw it at any time (see \"Your rights\"). Withdrawing consent does not affect processing already carried out, and may mean we can no longer provide parts of the service.",
      ],
    },
    {
      heading: "3. Personal data we collect",
      body: ["We collect only what we need to run the service:"],
      bullets: [
        "Identity and contact details — your name, mobile number, email, and delivery addresses (including pincode).",
        "Order, subscription, and delivery data — plans, meals, schedules, order history, and delivery notes.",
        "Payment data — processed by our payment partner (Razorpay). We do not store your full card, UPI, or bank credentials on our servers.",
        "Dietary and wellness preferences you choose to share — allergens, foods to avoid, diet style, and goals. Some of this can reveal health-related information; we process it only to personalise your meals and guidance, on the basis of your consent, and you can edit or remove it at any time.",
        "Nutrition-coach conversations — the messages you send the coach (personal identifiers within them are masked before storage).",
        "Device and usage data — app/website interactions, device and log information, and cookies (see \"Cookies\").",
      ],
    },
    {
      heading: "4. How we use your data and why",
      body: ["We use your personal data for these purposes:"],
      bullets: [
        "To fulfil orders and subscriptions — prepare, bill, and deliver your meals and manage your plan.",
        "To take payments and prevent fraud — via Razorpay, and to detect and prevent misuse.",
        "To personalise your experience — rank menus, tailor the nutrition coach, and honour your dietary preferences and allergen filters.",
        "To provide dietitian (RD) bookings and support you when you contact us.",
        "To keep food safe and meet legal duties — including our obligations as an FSSAI-registered food business, and tax, accounting, and other legal requirements.",
        "To send service messages, and — only with your consent — marketing about offers and new features. You can opt out of marketing at any time.",
      ],
    },
    {
      heading: "5. The nutrition coach and automated features",
      body: [
        "The nutrition coach uses an AI model to generate general guidance from your message and preferences. Before any conversation is stored, personal identifiers in your message (such as email, phone, or pincode) are masked.",
        "The coach provides general nutrition information, not medical advice, and is designed to route clinical questions to a Registered Dietitian. See our Health & Nutrition Disclaimer. You are not required to use the coach.",
      ],
    },
    {
      heading: "6. When we share your data",
      body: [
        "We do not sell your personal data. We share it only as needed to run the service, with providers bound to protect it:",
      ],
      bullets: [
        "Payment processing — Razorpay (and the banks/networks it uses).",
        "Delivery — our delivery partners and riders, who receive the details needed to reach you.",
        "Cloud hosting and infrastructure — our cloud provider (Google Cloud).",
        "The nutrition coach's AI processing — our AI model provider (Google), which processes masked messages to generate a reply.",
        "Legal and regulatory disclosures — where required by law, regulation, court, or a lawful authority (including food-safety and tax authorities).",
        "Business transfers — if the business is merged, acquired, or reorganised, subject to this policy.",
      ],
    },
    {
      heading: "7. Cross-border processing",
      body: [
        "Some of our processors may store or process your personal data on servers located outside India. Where they do, we take steps consistent with the DPDP Act and applicable transfer restrictions to keep your data protected.",
      ],
    },
    {
      heading: "8. Cookies and similar technologies",
      body: [
        "We use essential cookies to keep you signed in and the service working, and analytics cookies to understand and improve usage. You can control cookies through your browser settings; disabling essential cookies may break parts of the service.",
      ],
    },
    {
      heading: "9. How long we keep your data",
      body: [
        "We keep your personal data for as long as your account is active and as needed for the purposes above, and thereafter only as required to meet legal, tax, accounting, and food-safety record-keeping obligations or to resolve disputes.",
        "In line with the DPDP Rules, where the law requires it we will erase personal data that is no longer needed after a defined period of account inactivity, after giving you advance notice so you can keep your account active.",
      ],
    },
    {
      heading: "10. How we protect your data",
      body: [
        "We use reasonable technical and organisational security safeguards, including encryption of sensitive fields at rest and access controls, to protect your personal data. No method of transmission or storage is completely secure, but we work to protect your data and to review our safeguards.",
      ],
    },
    {
      heading: "11. Your rights",
      body: [
        "Subject to the DPDP Act, you have the right to:",
      ],
      bullets: [
        "Access — get a summary of the personal data we process about you and how.",
        "Correction and completion — fix inaccurate or incomplete data (you can edit much of it in your account).",
        "Erasure — ask us to delete your personal data where it is no longer needed and the law does not require us to keep it.",
        "Grievance redressal — raise a complaint with our Grievance Officer (below).",
        "Nomination — nominate another individual to exercise your rights in the event of your death or incapacity.",
        "Withdraw consent — as easily as you gave it, at any time.",
      ],
    },
    {
      heading: "12. Children's data",
      body: [
        `${C.brand} is intended for adults (18+) and is not directed at children. We do not knowingly process a child's personal data without verifiable consent of a parent or lawful guardian, and we do not use children's data for tracking, behavioural monitoring, or targeted advertising, consistent with the DPDP Act. If you believe a child has provided us data without such consent, contact us and we will act on it.`,
      ],
    },
    {
      heading: "13. Grievances and the Data Protection Board",
      body: [
        `If you have a concern about how we handle your personal data, contact our Grievance Officer, ${C.grievanceOfficer}, at ${C.grievanceEmail}. We will acknowledge and respond within the timelines required by law.`,
        "If your grievance is not resolved to your satisfaction, you may escalate it to the Data Protection Board of India in accordance with the DPDP Act.",
      ],
    },
    {
      heading: "14. Personal-data breaches",
      body: [
        "In the event of a personal-data breach, we will notify you and the Data Protection Board of India as required by the DPDP Act and the DPDP Rules, including the nature of the breach, its likely consequences, the measures we are taking, and steps you can take to protect yourself.",
      ],
    },
    {
      heading: "15. Changes to this policy",
      body: [
        "We may update this Privacy Policy from time to time. We will post the updated version with a new \"Last updated\" date and, where the change is significant, take reasonable steps to notify you.",
      ],
    },
    {
      heading: "16. Contact us",
      body: [
        `${C.legalName} · ${C.registeredOffice} · Privacy: ${C.privacyEmail} · Grievance Officer: ${C.grievanceOfficer}, ${C.grievanceEmail} · Support: ${C.supportEmail}, ${C.supportPhone}.`,
      ],
    },
  ],
};
