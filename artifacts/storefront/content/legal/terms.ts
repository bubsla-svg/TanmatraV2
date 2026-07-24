import type { LegalDoc } from "./types";
import { COMPANY as C } from "./company";

/**
 * Terms of Service. Covers the subscription/autopay money path, FSSAI food
 * compliance, and the coach/RD "not medical advice" boundary. Cross-references
 * the Refund & Cancellation, Shipping & Delivery, and Disclaimer pages.
 */
export const termsDoc: LegalDoc = {
  slug: "terms",
  title: "Terms of Service",
  summary:
    "The terms on which you use Tanmatra — accounts, subscriptions and billing, delivery, the nutrition coach, and your and our responsibilities.",
  updated: C.updated,
  sections: [
    {
      heading: "1. About these terms",
      body: [
        `${C.brand} is operated by ${C.legalName} ("we", "us", "our"). These Terms of Service govern your use of the ${C.brand} website, apps, and services (the "Platform"). By creating an account or placing an order, you agree to these terms, our Privacy Policy, Refund & Cancellation Policy, Shipping & Delivery Policy, and Health & Nutrition Disclaimer.`,
      ],
    },
    {
      heading: "2. Eligibility",
      body: [
        "You must be at least 18 years old and able to enter into a binding contract to use the Platform. By using it, you confirm that you meet these requirements and that the information you provide is accurate.",
      ],
    },
    {
      heading: "3. Your account",
      body: [
        "You register and sign in using your mobile number and a one-time password (OTP). You are responsible for keeping access to your number and account secure and for activity under your account. Tell us promptly if you suspect unauthorised use. Please keep your contact and delivery details accurate so we can serve you.",
      ],
    },
    {
      heading: "4. The service",
      body: [
        "The Platform offers freshly prepared meals through subscription plans and individual (à la carte) orders, along with a nutrition coach and Registered Dietitian (RD) bookings. Availability of meals, plans, delivery slots, and areas can change and is subject to serviceability at your location.",
      ],
    },
    {
      heading: "5. Food, menus, and FSSAI compliance",
      body: [
        `Our food is prepared under FSSAI Licence No. ${C.fssaiLicenseNo}. We prepare food in a licensed kitchen and follow applicable food-safety standards.`,
        "Nutrition information (such as calories and macros), ingredients, and images are provided in good faith to help you choose, and may be estimates that vary with natural ingredients and preparation. Menu photos are indicative.",
        "Allergen information is provided to help you decide, but our meals are prepared in a shared kitchen where cross-contact can occur. If you have a food allergy or intolerance, please read the Health & Nutrition Disclaimer and take your own precautions.",
      ],
    },
    {
      heading: "6. Subscriptions, billing, and autopay",
      body: [
        "When you start a subscription you choose a plan, cadence, and meal count, and authorise recurring payments. Payments are collected through our payment partner (Razorpay), including via UPI AutoPay / e-mandate where you set that up.",
        "By starting a subscription and authorising autopay, you permit us to charge the applicable amount for each upcoming cycle until you cancel. Where a change increases your recurring amount, we will seek your fresh authorisation as required. Prices are in Indian Rupees and are inclusive of applicable taxes unless stated otherwise; taxes such as GST apply as per law.",
        "Free trials or introductory offers, where available, are subject to their stated terms and may convert into a paid plan unless you cancel before the stated cut-off.",
      ],
    },
    {
      heading: "7. Changing, skipping, pausing, and cancelling",
      body: [
        "You can manage your plan from your account — change cadence or meal count, skip or pause an upcoming delivery, or cancel. Skips, pauses, and changes must be made before the cut-off for the affected delivery; after the cut-off the delivery may already be in preparation and cannot be changed.",
        "You can cancel your subscription at any time. Cancellation stops future billing; it does not by itself refund amounts already charged for meals already prepared or dispatched. See the Refund & Cancellation Policy for details.",
      ],
    },
    {
      heading: "8. Pricing, credits, and payments",
      body: [
        "Prices, applicable charges, and any delivery fees are shown before you confirm. We may apply account credits (for example, from referrals, goodwill, or prior adjustments) to eligible orders; credits have no cash value except as required by law and may expire. Promotional offers may carry their own conditions.",
      ],
    },
    {
      heading: "9. Delivery",
      body: [
        "We deliver only within serviceable areas and time windows shown on the Platform. You are responsible for providing an accurate address and being available to receive perishable food. See the Shipping & Delivery Policy for how deliveries, delays, and failed deliveries are handled.",
      ],
    },
    {
      heading: "10. Refunds and cancellation",
      body: [
        "Because meals are freshly prepared and perishable, refunds and cancellations are governed by our Refund & Cancellation Policy, which forms part of these terms.",
      ],
    },
    {
      heading: "11. Nutrition coach and RD services",
      body: [
        "The nutrition coach provides general nutrition information and is not medical advice, diagnosis, or treatment. RD bookings connect you with a Registered Dietitian for advisory guidance and do not create a doctor–patient relationship or provide emergency care. Always consult a qualified healthcare professional for medical concerns. See the Health & Nutrition Disclaimer.",
      ],
    },
    {
      heading: "12. Acceptable use",
      body: ["When using the Platform, you agree not to:"],
      bullets: [
        "use it for any unlawful, fraudulent, or harmful purpose, or to place fake or abusive orders;",
        "resell our meals or the service without our written permission;",
        "attempt to disrupt, reverse-engineer, scrape, or gain unauthorised access to the Platform; or",
        "misuse the nutrition coach or submit content that is unlawful, abusive, or infringing.",
      ],
    },
    {
      heading: "13. Intellectual property",
      body: [
        `The Platform, including its content, branding, and software, is owned by ${C.legalName} or its licensors and is protected by law. We grant you a limited, personal, non-transferable licence to use the Platform for its intended purpose. Any feedback or content you submit may be used by us to operate and improve the service.`,
      ],
    },
    {
      heading: "14. Third-party services",
      body: [
        "The Platform relies on third parties (for example Razorpay for payments, Google for hosting and AI, and delivery partners). Your use of those features may also be subject to the third party's terms, and we are not responsible for their services beyond our own obligations.",
      ],
    },
    {
      heading: "15. Disclaimers and limitation of liability",
      body: [
        "The Platform is provided on an \"as is\" and \"as available\" basis. To the fullest extent permitted by law, we exclude implied warranties and are not liable for indirect or consequential losses. Nothing in these terms limits liability that cannot be limited under Indian law, including for death or personal injury caused by our negligence or for fraud.",
        "To the extent permitted by law, our total liability arising out of or in connection with the service is limited to the amount you paid us for the order or billing cycle giving rise to the claim.",
      ],
    },
    {
      heading: "16. Indemnity",
      body: [
        "You agree to indemnify us against losses arising from your breach of these terms or your misuse of the Platform, to the extent permitted by law.",
      ],
    },
    {
      heading: "17. Suspension and termination",
      body: [
        "We may suspend or terminate your access if you breach these terms, if required by law, or to protect the service or other users. You may stop using the Platform and close your account at any time.",
      ],
    },
    {
      heading: "18. Changes to these terms",
      body: [
        "We may update these terms from time to time. We will post the updated version with a new \"Last updated\" date, and continued use after changes take effect means you accept them.",
      ],
    },
    {
      heading: "19. Governing law and jurisdiction",
      body: [
        `These terms are governed by the laws of India. Subject to any right you have to approach consumer forums, the courts at ${C.jurisdictionCity}, ${C.jurisdictionState} will have jurisdiction over disputes arising from these terms.`,
      ],
    },
    {
      heading: "20. Grievance and contact",
      body: [
        `Grievance Officer: ${C.grievanceOfficer}, ${C.grievanceEmail}. Support: ${C.supportEmail}, ${C.supportPhone}. Registered office: ${C.registeredOffice}. See the Grievance Redressal page for how we handle complaints and the timelines that apply.`,
      ],
    },
  ],
};
