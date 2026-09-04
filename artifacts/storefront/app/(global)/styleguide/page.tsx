"use client";

import React from "react";
import { PrimaryCTA, SecondaryCTA } from "@/components/primitives/CTA";
import { IconButton, CompactAction } from "@/components/primitives/ActionButtons";
import { ClinicalBadge, FilterChip } from "@/components/primitives/Badges";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

import { CardSection } from "@/components/primitives/CardSection";
import { StickyLedger } from "@/components/primitives/StickyLedger";
import { PriceDisplay } from "@/components/primitives/PriceDisplay";
import { GlobalHeader } from "@/components/primitives/Headers";
import { Skeleton } from "@/components/ui/skeleton";
import { TextInput, SearchInput } from "@/components/primitives/Inputs";
import { InlineError, EmptyState } from "@/components/primitives/Feedback";
import { BottomSheet, Modal } from "@/components/primitives/Overlays";
import { SquircleOptionCard } from "@/components/primitives/OptionCards";
import { QuantityStepper } from "@/components/primitives/QuantityStepper";
import { Disclosure } from "@/components/primitives/Disclosure";
import { Rail } from "@/components/primitives/Rail";
import { StickyAction } from "@/components/primitives/StickyAction";

/** PR-11b primitives, live: the stepper needs local state to demonstrate. */
function PrimitivesShowcase() {
  const [qty, setQty] = React.useState(2);
  return (
    <section className="space-y-6">
      <h2 className="text-xl font-bold tracking-tight text-ink mb-6 border-b border-line pb-2">Primitives (PR-11b)</h2>
      <div className="flex flex-wrap items-center gap-4">
        <QuantityStepper value={qty} label="Demo quantity" onDecrease={() => setQty((q) => q - 1)} onIncrease={() => setQty((q) => q + 1)} />
        <QuantityStepper value={qty} label="Demo quantity (accent)" tone="accent" onDecrease={() => setQty((q) => q - 1)} onIncrease={() => setQty((q) => q + 1)} />
        <QuantityStepper value={qty} label="Demo quantity (pending)" pending onDecrease={() => undefined} onIncrease={() => undefined} />
      </div>
      <Disclosure
        defaultOpen={0}
        items={[
          { key: "a", summary: "A disclosure row", body: "One row open at a time; aria-expanded and aria-controls on the trigger, a labelled region for the panel." },
          { key: "b", summary: "Another row", body: "The open row lifts as a filled card; closed rows keep the decorative hairline." },
        ]}
      />
      <Rail bleed="gutter" className="gap-3 pb-1">
        {["Rail", "with", "snap", "start", "and", "a", "trailing", "fade", "cue"].map((w) => (
          <div key={w} className="w-40 shrink-0 snap-start rounded-card bg-surface-raised p-4 text-sm font-semibold text-ink">
            {w}
          </div>
        ))}
      </Rail>
      <StickyAction className="static rounded-card px-4 py-3">
        <p className="text-sm text-ink">StickyAction, glass chrome — rendered static here; callers pin it with bottom-0 / bottom-16 and a z-index.</p>
      </StickyAction>
    </section>
  );
}

export default function StyleguidePage({
  searchParams,
}: {
  searchParams: Promise<{ theme?: string }>;
}) {
  const theme = React.use(searchParams).theme === "light" ? "light" : "dark";
  return (
    <div
      data-ui-generation="stitch-74"
      data-screen-id={theme === "light" ? "4.2" : "4.1"}
      data-screen-state={theme}
      className="min-h-dvh bg-bg text-ink pb-24"
    >
      <GlobalHeader />
      
      {/* A <div>: this page sits in the (global) route group, whose layout
          already wraps children in <main id="main">. */}
      <div className="max-w-screen-xl mx-auto px-4 py-8 space-y-12">
        <section className="space-y-4">
          <h2 className="text-xl font-bold tracking-tight text-ink mb-6 border-b border-line pb-2">CTAs & Buttons</h2>
          <div className="flex flex-wrap gap-4 items-center">
            <PrimaryCTA>Primary CTA</PrimaryCTA>
            <SecondaryCTA>Secondary CTA</SecondaryCTA>
            <CompactAction>
              Compact Action
            </CompactAction>
            <IconButton icon={<span className="w-6 h-6 block bg-surface-raised rounded-full" />} variant="solid" />
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-bold tracking-tight text-ink mb-6 border-b border-line pb-2">Inputs & Forms</h2>
          <div className="max-w-md space-y-4">
            <TextInput label="Email Address" placeholder="clinical@tanmatra.com" />
            <SearchInput />
            <TextInput label="Password" type="password" error="Minimum 8 characters required." />
            <InlineError message="Failed to authenticate credentials." />
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-bold tracking-tight text-ink mb-6 border-b border-line pb-2">Badges & Chips</h2>
          <div className="flex flex-wrap gap-4 items-center">
            <ClinicalBadge label="32P · 41C · 12F" variant="slate" />
            <ClinicalBadge label="Metabolic Core" variant="emerald" />
            <ClinicalBadge label="Gold Protocol" variant="gold" />
          </div>
          <div className="flex flex-wrap gap-4 items-center mt-4">
            <FilterChip label="All Meals" isSelected={true} onClick={() => {}} count={24} />
            <FilterChip label="Low Carb" isSelected={false} onClick={() => {}} count={8} />
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-bold tracking-tight text-ink mb-6 border-b border-line pb-2">Option Cards</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <SquircleOptionCard 
              title="Weight Management" 
              description="A calibrated protocol designed to lower fasting insulin." 
              isSelected={true} 
              onClick={() => {}} 
            />
            <SquircleOptionCard 
              title="Performance" 
              description="High-protein macro profile to support endurance." 
              isSelected={false} 
              onClick={() => {}} 
            />
          </div>
        </section>

        <PrimitivesShowcase />

        <section className="space-y-4">
          <h2 className="text-xl font-bold tracking-tight text-ink mb-6 border-b border-line pb-2">Empty State</h2>
          <div className="bg-surface rounded-3xl border border-line p-4">
            <EmptyState 
              title="No upcoming deliveries" 
              description="You have skipped this week's protocol." 
              actionLabel="Resume Plan" 
              onAction={() => {}} 
            />
          </div>
        </section>
      </div>
      {/* D-17: no in-page duplicate nav demo any more — app/(global)/layout.tsx
          already mounts the real MobileBottomNav for every (global) route,
          including this one. That's "the real one" this branch points at. */}
    </div>
  );
}
