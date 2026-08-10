"use client";

import React from "react";
import { PrimaryCTA, SecondaryCTA } from "@/components/primitives/CTA";
import { IconButton, CompactAction } from "@/components/primitives/ActionButtons";
import { ClinicalBadge, FilterChip } from "@/components/primitives/Badges";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

import { HorizontalSnapRail } from "@/components/primitives/HorizontalSnapRail";
import { StickyLedger } from "@/components/primitives/StickyLedger";
import { PriceDisplay } from "@/components/primitives/PriceDisplay";
import { GlobalHeader } from "@/components/primitives/Headers";
import { BottomTabBar } from "@/components/primitives/BottomTabBar";
import { Skeleton } from "@/components/ui/skeleton";
import { TextInput, SearchInput } from "@/components/primitives/Inputs";
import { InlineError, EmptyState } from "@/components/primitives/Feedback";
import { BottomSheet, Modal } from "@/components/primitives/Overlays";
import { SquircleOptionCard } from "@/components/primitives/OptionCards";

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
      className="min-h-screen bg-bg text-ink pb-24"
    >
      <GlobalHeader />
      
      <main className="max-w-screen-xl mx-auto px-4 py-8 space-y-12">
        <section className="space-y-4">
          <h2 className="text-xl font-bold tracking-tight text-white mb-6 border-b border-white/10 pb-2">CTAs & Buttons</h2>
          <div className="flex flex-wrap gap-4 items-center">
            <PrimaryCTA>Primary CTA</PrimaryCTA>
            <SecondaryCTA>Secondary CTA</SecondaryCTA>
            <CompactAction>
              Compact Action
            </CompactAction>
            <IconButton icon={<span className="w-6 h-6 block bg-white/20 rounded-full" />} variant="solid" />
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-bold tracking-tight text-white mb-6 border-b border-white/10 pb-2">Inputs & Forms</h2>
          <div className="max-w-md space-y-4">
            <TextInput label="Email Address" placeholder="clinical@tanmatra.com" />
            <SearchInput />
            <TextInput label="Password" type="password" error="Minimum 8 characters required." />
            <InlineError message="Failed to authenticate credentials." />
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-bold tracking-tight text-white mb-6 border-b border-white/10 pb-2">Badges & Chips</h2>
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
          <h2 className="text-xl font-bold tracking-tight text-white mb-6 border-b border-white/10 pb-2">Option Cards</h2>
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

        <section className="space-y-4">
          <h2 className="text-xl font-bold tracking-tight text-white mb-6 border-b border-white/10 pb-2">Empty State</h2>
          <div className="bg-surface rounded-3xl border border-white/5 p-4">
            <EmptyState 
              title="No upcoming deliveries" 
              description="You have skipped this week's protocol." 
              actionLabel="Resume Plan" 
              onAction={() => {}} 
            />
          </div>
        </section>
      </main>
      
      <BottomTabBar activeTab="home" onTabSelect={() => {}} />
    </div>
  );
}
