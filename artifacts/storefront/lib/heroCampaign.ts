/**
 * The hero's announcement / offer slot.
 *
 * The hero is the one banner marketing actually wants to change — a festival
 * offer, a new-city launch, a delivery-fee waiver, a menu drop. This module is
 * that slot: edit `HERO_CAMPAIGNS`, ship, and the strip appears above the
 * headline. Nothing else on the page needs to move.
 *
 * It is deliberately SEPARATE from `deriveHeroContent()`. That function varies
 * the hero by referral cookie (a dietitian's patient sees different copy than a
 * gym's member); this one is a time-boxed message shown to everyone. They
 * compose: a referred visitor during a live offer sees both.
 *
 * TWO RULES, because this slot makes commercial promises.
 *
 * 1. IT EXPIRES BY ITSELF. A campaign with `endsAt` stops rendering the moment
 *    it passes — nobody has to remember to take it down. An offer that outlives
 *    its terms is not stale copy, it is a promise the kitchen will be asked to
 *    keep at the counter.
 * 2. IT SHIPS EMPTY. There is no placeholder campaign in this list and there
 *    must never be one. A demo offer is indistinguishable from a real one to
 *    the person reading it.
 *
 * To run one, add an entry:
 *
 *   export const HERO_CAMPAIGNS: HeroCampaign[] = [
 *     {
 *       id: "diwali-2026",
 *       message: "Diwali week: free delivery on every plan.",
 *       cta: { label: "See plans", href: "/plans" },
 *       startsAt: "2026-11-06T00:00:00+05:30",
 *       endsAt: "2026-11-13T00:00:00+05:30",
 *     },
 *   ];
 *
 * Prices belong in the copy only as a reference to a real one (see
 * heroContent.ts, which formats from PLAN_PRICE_TABLE). Never type an amount
 * here that no table backs.
 */
export interface HeroCampaign {
  /** Stable slug — also the analytics label and the React key. */
  id: string;
  /** One line. If it needs two, it is a section, not a banner. */
  message: string;
  /** Optional destination. Omit for a pure announcement. */
  cta?: { label: string; href: string };
  /** ISO 8601. Absent = live as soon as it ships. */
  startsAt?: string;
  /** ISO 8601. Absent = runs until removed — use only for standing notices. */
  endsAt?: string;
}

/**
 * Live campaigns. See rule 2 above before adding a placeholder — every entry
 * here must be a claim that is true today.
 *
 * The pre-launch notice is the reason this slot exists. Until the kitchen
 * opens, the homepage headline ("Cooked today, at your desk by one") describes
 * a service that is not yet running, and `PLAN_CHECKOUT_DISABLED` /
 * `ORDER_FINALIZE_DISABLED` mean no one can complete an order anyway. Without
 * this line a visitor reads placeholder dish photography and estimated macros
 * as a live storefront's failings, rather than as a kitchen that has not opened.
 *
 * Rule 1 does the retiring: `endsAt` is the launch instant, so this removes
 * itself the moment the kitchen opens. Nobody has to remember.
 */
export const HERO_CAMPAIGNS: HeroCampaign[] = [
  {
    id: "pre-launch-sep-2026",
    message: "Our kitchen opens 1 September — browse the menu now, ordering opens then.",
    cta: { label: "See the menu", href: "/menu" },
    endsAt: "2026-09-01T00:00:00+05:30",
  },
];

function withinWindow(campaign: HeroCampaign, now: Date): boolean {
  const t = now.getTime();
  if (campaign.startsAt) {
    const start = Date.parse(campaign.startsAt);
    // An unparseable date is treated as "not yet live", never as "always on":
    // a typo must fail the campaign closed, not broadcast it forever.
    if (Number.isNaN(start) || t < start) return false;
  }
  if (campaign.endsAt) {
    const end = Date.parse(campaign.endsAt);
    if (Number.isNaN(end) || t >= end) return false;
  }
  return true;
}

/**
 * The campaign to show right now, or null.
 *
 * First match wins, so list order is priority order — two overlapping
 * campaigns resolve deterministically instead of racing.
 *
 * `now` is a parameter rather than a `new Date()` inside, so the window logic
 * is testable and so a Server Component renders one consistent instant.
 */
export function activeCampaign(
  now: Date,
  campaigns: readonly HeroCampaign[] = HERO_CAMPAIGNS,
): HeroCampaign | null {
  return campaigns.find((c) => withinWindow(c, now)) ?? null;
}
