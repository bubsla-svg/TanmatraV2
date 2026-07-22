# `feature/native-onboarding-flow` → `main`: Port Plan

**Status:** proposal · **Author:** analysis pass · **Base:** `main` @ `2e0b9eb` (post #298)
**Subject branch:** `feature/native-onboarding-flow` @ `39f72ba`

This document scopes how to bring the wanted parts of `feature/native-onboarding-flow`
onto `main`. The headline conclusion drives everything below:

> **This is a port, not a merge.** The two branches share **zero git history** — a
> `git merge` is impossible, and a union merge would corrupt `main`. Each wanted
> feature must be **rebuilt as a fresh, single-concern PR** on top of current `main`.

---

## 1. Why a merge is off the table (evidence)

| Check | Result |
|---|---|
| `git merge-base main native` | *(empty — no common ancestor)* |
| `git merge-tree --write-tree main native` | `fatal: refusing to merge unrelated histories` |
| Shared commits (all 256 vs 823 OIDs compared) | **0** |
| Root commits | main has 2 (`efc7927`, `8e9ac7a`); native has 1 (`16a33ae`) |

`native` is a **separate repository lineage** (823 commits, its own root) pushed in as
a branch. It was seeded from a snapshot of the product at some past point, so many
files are byte-identical, but the histories never touch.

**Tree overlap** (main 5,726 files · native 3,221 files):

| Bucket | Count | Meaning for a port |
|---|---:|---|
| Paths in both, byte-identical | 2,718 | no action |
| Paths in both, **divergent** | 254 | each is an add/add conflict — no 3-way base exists |
| Paths only on `main` | 2,754 | a union merge would wrongly *keep* all of these |
| Paths only on `native` (net-new) | 249 | the real candidate surface |

A union merge (`--allow-unrelated-histories`) would keep every `main`-only file (the
whole storefront, plan-v2 spine, api money-path) **and** layer native's divergent
tree on top → a ~5,975-file tree that reflects neither branch and will not build.

---

## 2. What is actually unique on `native`

Most of what the branch *appears* to add already exists on `main` in a parallel,
often **newer** state. Classification of the key surfaces:

| Surface | On main? | Direction | Port? |
|---|---|---|---|
| **Mobile onboarding** (`tanmatra-mobile/…/OnboardingFlow.tsx` + libs) | **No** | native-only | **YES — Tier 1** |
| `/auth/truecaller/verify` endpoint | No | native-only | **YES, but hardened — Tier 1** |
| `/auth/phone/send-otp` · `/auth/phone/verify-otp` | **Yes** (storefront already calls them) | — | **No — reuse main's** |
| Web `LocationPickerFlow.tsx` | Yes | **main is newer** (modern Places API + `PickerMap`); native uses legacy Maps JS loader | **No — porting = regression** |
| Web onboarding (`SoftGate`, `PostCheckoutWizard`, `OnboardingQuizGate`) | Yes | divergent; `SoftGate` is **dead code** on native | **No** (see §5) |
| Serviceable-pincode data | Yes | web 8 (main) / 14 (native) vs server 30 | **Data only — Tier 2, governance-gated** |
| `pickupLocations` DB schema | **Identical on both** | — | **No — already landed** |
| Web rebrand `tanmatra-v2/` (49 pages, 21.5k lines) + "Nocturnal Nourishment" palette | Yes — **already live on main** | divergent (47/52 files) | **No — see §5, color-lock gate** |
| Stitch "4 Pillars" preview pages (5) | Partial | divergent | **Optional — Tier 3** |
| `stitchDesignTokens.ts`, `clinicalTheme.ts`, `StitchClinicalOverview.tsx` | mixed | dead code / unrelated | **No** |
| `artifacts/agents/` (Replit shadcn browser), `mockup-sandbox` | native-only | throwaway scaffolding | **No** |

### Everything native ships is a stub

The onboarding libs are **simulations**, not integrations — the branch adds **no new
npm packages**:

- `truecaller.ts` — no Truecaller SDK; fabricates `tc_oauth_token_<Date.now()>` and a
  hardcoded phone `+919876543210`, POSTs to the backend.
- `location.ts` — no `expo-location`; always returns a hardcoded Indiranagar fixture.
- `smsRetriever.ts` — no native module; hardcoded app hash `FA+9qK71234` + a regex OTP
  extractor and a no-op listener.

So a "port" is really a **rebuild to production quality**: the native code is a useful
UX blueprint, but the real SDK wiring and server verification do not exist yet.

---

## 3. Governance gates (must clear before the relevant PR merges)

1. **Truecaller endpoint = auth bypass (BLOCKER).** Native's `/auth/truecaller/verify`
   accepts client-supplied `phoneE164` + `truecallerToken` with **no server-side
   verification** — any caller can mint a verified-phone session for any number. Per
   `.claude/rules/ecc/common/security.md`, this must be fixed (verify the Truecaller
   token against Truecaller's JWKS/servers) **before** the endpoint ships. Do **not**
   port the trust-any-token behaviour.
2. **Color lock (CLAUDE.md).** The "Nocturnal Nourishment" palette introduces
   **new base colors** not in the locked Clinical set — `#fbbf24` (amber),
   `#34daff` (cyan) — alongside the locked `#D4AF37 / #6BA3C8 / #7D9E7E`. Any web
   rebrand port needs **explicit design + color approval**. Blocked by default.
3. **Never invent serviceability data.** The serviceable-pincode lists diverge
   (web 8/14, server 30). Consolidation is fine; **adding new pincodes is a data
   decision for the team** — do not invent coverage. Single source of truth should be
   the server list in `lib/api-zod`.
4. **Money-path lockstep.** Any PR that touches checkout/pricing/subscription creation
   follows `docs/AGENT_WORKING_AGREEMENT.md` (read before committing).

---

## 4. Proposed PR sequence (small, single-concern)

Ordered so each PR is independently reviewable and mergeable. Tier 1 is the real
deliverable; later tiers are opt-in and gated.

### Tier 1 — Mobile native onboarding (the headline feature)

> Target: `artifacts/tanmatra-mobile` (Expo). Rebuild native's flow to production
> quality on current `main`. Everything below is genuinely net-new to `main`.

- **PR 1 — Server: harden Truecaller sign-in.**
  Add `POST /auth/truecaller/verify` to `artifacts/api-server/src/routes/auth.ts`
  **with real token verification** (Truecaller JWKS/signature + phone match), reusing
  the existing `createSession` / `usersTable` upsert path. Add rate limiting and tests
  (valid token, forged token → 401, replay). *Gate: §3.1. Money-path adjacent? No, but
  auth-sensitive → security-reviewer.*

- **PR 2 — Mobile: phone-OTP onboarding shell.**
  Port `OnboardingFlow.tsx` (689 lines) as the phone→OTP→location wizard, wired to
  **main's existing** `/auth/phone/send-otp` + `/auth/phone/verify-otp`. Bring
  `smsRetriever.ts` **backed by a real Android SMS Retriever module** (or explicitly
  ship as manual-entry only and file a follow-up). Real 45s resend timer, haptics
  (`expo-haptics` already present). Wire into `app/index.tsx`. *No new colors — reuse
  mobile `constants/colors.ts` (already keeps the locked accents over a dark base).*

- **PR 3 — Mobile: real location gate.**
  Port `location.ts` backed by **real `expo-location`** (add the dep) — GPS permission,
  reverse-geocode, `expo-secure-store` persistence, manual-pincode fallback. Serviceability
  check calls the **server** list (per §3.3), not a hardcoded copy. Include
  `HyperlocalHeader.tsx` (257 lines) if the location-aware header is wanted.

- **PR 4 — Mobile: Truecaller 1-tap (optional, depends on PR 1).**
  Add the real Truecaller SDK dependency + native config, replace the stub
  `truecaller.ts`, wire the "1-Tap Login" button in `OnboardingFlow`. Ships only after
  PR 1's verified endpoint is merged. *Gate: §3.1.*

- **PR 5 — Mobile menu polish (optional).**
  `MenuCard.tsx` (335) + `ProtocolSwitcher.tsx` (153) if the "protocol switcher" menu
  UX is wanted on mobile. Independent of onboarding — can drop or defer.

### Tier 2 — Serviceability data hygiene (tiny, high-value)

- **PR 6 — One serviceable-pincode source of truth.**
  Make the web client consume `lib/api-zod`'s `SERVICEABLE_PINCODES` (or a
  `/serviceability?pincode=` endpoint) instead of its own hardcoded list; delete the
  duplicate. **No coverage change** unless the team supplies new pincodes (§3.3). Add a
  test asserting client and server agree. Fixes the silent-422 mismatch that exists on
  both branches today.

### Tier 3 — Web rebrand & Stitch previews (opt-in, design-gated)

> `main` already runs `tanmatra-v2` live, so this is **reconciliation of two parallel
> rebrands**, not a port. Only pursue if the team wants native's specific NN direction.

- **PR 7 — (only if approved) NN palette tokens.**
  Add the 14 `--color-nn-*` tokens to `index.css @theme`. **Blocked on §3.2** (new base
  colors). Small mechanically; the gate is approval, not effort.
- **PR 8 — (only if PR 7 lands) Stitch "4 Pillars" preview pages.**
  The 5 `Stitch*.tsx` pages (1,096 lines) + `stitchCartStore.ts` as unlinked
  `/stitch/*` routes. Depends on PR 7's tokens.
- **Full `tanmatra-v2` page-tree reconciliation** (44 pages, ~20k lines, wrapper
  rewrites, `src/components/home/*` coupling) is **Large / re-platform scale** and
  explicitly **out of scope** for a port. If the team wants native's page-level changes,
  diff them page-by-page against main's live `tanmatra-v2` as separate design PRs — not
  a bulk copy.

### Explicitly excluded

`artifacts/agents/`, `artifacts/mockup-sandbox`, `stitchDesignTokens.ts`,
`clinicalTheme.ts`, `StitchClinicalOverview.tsx`, native's web `LocationPickerFlow.tsx`
(main's is newer), native's web onboarding components (main's are current;
`SoftGate` is dead code — see §5).

---

## 5. Landmines found (don't copy these forward)

- **`SoftGate.tsx` is inert.** It is unmounted anywhere, yet `OnboardingQuizGate`
  imports its `isSoftGateResolved()` — which, because SoftGate never mounts, returns
  `false` forever and **permanently suppresses the quiz banner**. If any onboarding
  port touches this, either mount SoftGate for real or cut the `isSoftGateResolved()`
  coupling.
- **Divergent pincode lists** already cause silent checkout 422s (client says
  serviceable, server rejects). PR 6 fixes it; don't reintroduce a second list.
- **`pickupLocations` is scaffolding.** The table + FK exist on `main`, but the gate
  uses a mock `isServiceable`. Not wired to onboarding — leave out of scope unless the
  pickup-vs-delivery feature is separately prioritized.

---

## 6. Open questions for the team

1. **Onboarding target:** mobile-only (Expo), as native built it? Or is a web/storefront
   equivalent also wanted? (Main's storefront already has OTP-based `CheckoutIdentity`.)
2. **Truecaller:** ship the real SDK (PR 1 + 4), or keep phone-OTP only for now and defer
   Truecaller?
3. **NN rebrand:** pursue native's "Nocturnal Nourishment" direction at all, given
   `main` already runs its own `tanmatra-v2`? If yes, who approves the new base colors
   (§3.2)?
4. **Stitch "4 Pillars" previews:** wanted as `/stitch/*` demo routes, or drop?

Recommended first step: **Tier 1, PR 1 → PR 3** (mobile onboarding on main's existing
OTP), leaving Truecaller (PR 4) and the whole web rebrand behind their approval gates.
