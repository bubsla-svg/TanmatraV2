# Stitch Gap-Screen Designs — Nocturnal Nourishment

Designs generated in the **"Tanmatra Premium Home"** Stitch project (design system
`assets/106b16df259546709f872934018d7892`) for the 16 §9 gap routes from
`stitch-design-coverage.md` — the routes that were implemented but had **no NN design**.
Reference PNGs (and, for admin, the source HTML) live under `docs/stitch-designs/`.

**Every design was prompted to uphold the §10 honest-data standard** (fail-closed
compliance/allergen states, no fabricated stats/ratings, data-bound numbers, reviewer +
date on approvals). A port must preserve that — see the port brief
(`agent-nn-port-brief.md`).

## Customer screens (15 — durable in the Stitch project)

| Design | Route | Live component to align | Device | Reference |
|---|---|---|---|---|
| Trial Recap & Upgrade Bridge | `/subscription/bridge` | `pages/SubscriptionBridge.tsx` | mobile | `customer/subscription-bridge.png` |
| Billing & Invoices | `/account/billing` | `pages/Billing.tsx` | mobile | `customer/account-billing.png` |
| Refund & Cancellation Policy | `/refunds` | `pages/Refunds.tsx` → `tanmatra-v2/Refunds.tsx` | mobile | `customer/refunds.png` |
| Corporate Lunch Planner | `/corporate/:slug/lunch-planner` | `pages/CorporateLunchPlanner.tsx` | desktop | `customer/corporate-lunch-planner.png` |
| Office Lunch Selection | `/office-lunch/:id` | `pages/OfficeLunch.tsx` | mobile | `customer/office-lunch.png` |
| RD Partner Recruitment Landing | `/rd-partners` | `pages/RdPartnersLanding.tsx` | mobile | `customer/rd-partners-landing.png` |
| RD Partner: Credentials | `/rd-partners/apply` (step 1) | `pages/RdPartnersWizard.tsx` | mobile | `customer/rd-partners-apply-1-credentials.png` |
| RD Partner: Specializations | `/rd-partners/apply` (step 2) | `pages/RdPartnersWizard.tsx` | mobile | `customer/rd-partners-apply-2-specializations.png` |
| RD Partner: Practice Details | `/rd-partners/apply` (step 3) | `pages/RdPartnersWizard.tsx` | mobile | `customer/rd-partners-apply-3-practice.png` |
| RD Partner: Documents | `/rd-partners/apply` (step 4) | `pages/RdPartnersWizard.tsx` | mobile | `customer/rd-partners-apply-4-documents.png` |
| RD Partner: Review & Success | `/rd-partners/apply` (step 5) | `pages/RdPartnersWizard.tsx` | mobile | `customer/rd-partners-apply-5-review.png` |
| Dietitian RD Console: Client Dashboard | `/rd-console` (tab) | `pages/RdConsole.tsx` | desktop | `customer/rd-console-1-clients.png` |
| Dietitian RD Console: Plan Review Queue | `/rd-console` (tab) | `pages/RdConsole.tsx` | desktop | `customer/rd-console-2-review-queue.png` |
| Wellness Challenge Detail | `/challenges/:slug` | `pages/ChallengeDetail.tsx` → `tanmatra-v2/ChallengeDetail.tsx` | mobile | `customer/challenge-detail.png` |
| Voucher Wallet | `/vouchers` | `pages/Vouchers.tsx` → `tanmatra-v2/Vouchers.tsx` | mobile | `customer/voucher-wallet.png` |
| 404: Page Not Found | `*` | `pages/not-found.tsx` | mobile | `customer/generic-404.png` |

## Admin consoles (5 — NOT in the Stitch project list; PNG **and** HTML committed here)

These generated but never surfaced in `list_screens`, so their **source HTML is committed**
under `docs/stitch-designs/admin/` — that HTML is the authoritative reference for the port.
Stitch invented the brand name **"NutriCore"**; a port must use **Tanmatra** branding.

| Design | Route | Live component to align | Device | Reference (PNG + HTML) | Stitch screen id |
|---|---|---|---|---|---|
| Admin Menu Engineering Console | `/admin/menu-engineering` | `pages/AdminMenuEngineering.tsx` | desktop | `admin/menu-engineering.*` | `c7f061a6a3064c8db43e66d943326bc8` |
| Admin Compliance Console | `/admin/compliance` | `pages/AdminCompliance.tsx` | desktop | `admin/compliance.*` | `1634ff6c4932426a890862660e96dfad` |
| Admin Moderation Console | `/admin/moderation` | `pages/AdminModeration.tsx` | desktop | `admin/moderation.*` | `357647370c8a49fca7f04df7eb9d6bd0` |
| Admin Support Ticket Console | `/admin/support-tickets` | `pages/AdminSupportTickets.tsx` | desktop | `admin/support-tickets.*` | `d352fa75bd024c4c8aa9ba9ee19ebfbe` |
| RD Partner Application Review | `/admin/rd-applications` | `pages/AdminRdApplications.tsx` | desktop | `admin/rd-applications.*` | `2a0d9f8748a64bf7a145b74e26c24d35` |

## Notes

- **Ported from designs, not built from scratch** — every route already has a working
  component + data wiring. The port aligns the *presentation* to the design and preserves
  all logic and honest-data rendering.
- The reference PNGs are Stitch renders; treat them as the **visual target**, not
  pixel-law. Match layout, hierarchy, and the NN language (dark charcoal, amber primary,
  cyan tertiary, glass, rounded, Inter/Geist). Colours come from NN tokens, never raw hex.
- Customer HTML (if needed for exact structure) is retrievable from the Stitch project by
  the screen title while the project/API key are live; the admin HTML is already here.
