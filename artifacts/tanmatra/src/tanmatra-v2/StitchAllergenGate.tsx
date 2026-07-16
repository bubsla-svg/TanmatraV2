import { useState } from "react";
import {
  Warning,
  ShieldWarning,
  Grains,
  Drop,
  Plant,
  Info,
  ShieldCheck,
} from "@phosphor-icons/react";

/**
 * Clinical Allergen Gate — ported from the Stitch "Tanmatra Premium Home"
 * project (screen 06df1304…) on the Nocturnal Nourishment design system.
 * The medical-safety confirmation gate: the buyer verifies their active
 * exclusions before the kitchen locks out unsafe ingredients. Ties to the
 * server-side fail-closed safety engine (G9). Exclusions are demo data —
 * wire to the buyer's real preferences (`medicalConditions`/`allergens`) next.
 */

const EXCLUSIONS = [
  { icon: Grains, label: "Gluten", severity: "Severe" },
  { icon: Drop, label: "Dairy", severity: "Intolerance" },
  { icon: Plant, label: "Soy", severity: "Allergy" },
];

export default function StitchAllergenGate() {
  const [verified, setVerified] = useState(false);

  return (
    <div className="min-h-dvh bg-nn-bg text-nn-on-surface flex flex-col">
      <main className="flex-1 px-4 pt-12 pb-24 flex flex-col">
        {/* Header */}
        <div className="flex flex-col items-center text-center gap-6 mb-8">
          <div className="relative w-20 h-20 rounded-full bg-nn-error-container/20 flex items-center justify-center">
            <div className="absolute inset-0 rounded-full bg-nn-error-container/30 blur-xl animate-pulse" />
            <Warning size={40} weight="fill" className="relative text-nn-error" />
          </div>
          <div className="space-y-1">
            <h1 className="nn-display-lg-mobile text-nn-on-surface">Confirm Medical Safety Profile</h1>
            <p className="nn-body-lg text-nn-on-surface-variant max-w-[280px] mx-auto">
              Our kitchens use this data profile to lock out unsafe ingredients for your meal plan.
            </p>
          </div>
        </div>

        {/* Active Exclusions */}
        <div className="relative overflow-hidden rounded-2xl nn-glass p-6 mb-8">
          <div className="absolute top-0 left-0 w-1 h-full bg-nn-error" />
          <div className="flex items-center justify-between mb-4">
            <h2 className="nn-headline-md text-nn-on-surface flex items-center gap-2">
              <ShieldWarning size={22} weight="fill" className="text-nn-error" />
              Active Exclusions
            </h2>
            <button className="nn-label-caps text-nn-primary hover:opacity-80 transition-opacity">
              Edit
            </button>
          </div>
          <div className="flex flex-wrap gap-3">
            {EXCLUSIONS.map(({ icon: Icon, label, severity }) => (
              <span
                key={label}
                className="flex items-center gap-2 rounded-full px-4 py-2 bg-nn-error-container/20 border border-nn-error/30 backdrop-blur-md"
              >
                <Icon size={18} className="text-nn-error" />
                <span className="nn-body-sm text-nn-error">
                  {label} ({severity})
                </span>
              </span>
            ))}
          </div>
          <div className="mt-6 pt-4 border-t border-white/5">
            <p className="nn-body-sm text-nn-on-surface-variant flex items-start gap-2">
              <Info size={18} className="mt-0.5 opacity-70 shrink-0" />
              Cross-contamination protocols will be enforced for the selected ingredients above.
            </p>
          </div>
        </div>

        <div className="flex-1" />

        {/* Action area */}
        <div className="mt-auto space-y-4 pt-6">
          <button
            onClick={() => setVerified(true)}
            className="w-full h-14 rounded-xl bg-nn-on-surface text-nn-bg nn-headline-md flex items-center justify-center gap-2 shadow-[0_8px_24px_rgba(255,255,255,0.15)] active:scale-95 transition-transform hover:brightness-105"
          >
            <ShieldCheck size={22} weight="fill" />
            {verified ? "Profile Verified" : "Verify Profile & Create Menu"}
          </button>
          <p className="nn-micro-data text-nn-on-surface-variant text-center opacity-60 px-4">
            By verifying, you confirm these medical requirements are accurate. Tanmatra is not liable for undisclosed allergies.
          </p>
        </div>
      </main>
    </div>
  );
}
