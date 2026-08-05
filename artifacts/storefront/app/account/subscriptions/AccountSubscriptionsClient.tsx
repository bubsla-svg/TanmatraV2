"use client";

import Link from "next/link";

export default function AccountSubscriptionsClient() {
  return (
    <div className="bg-background text-clinical-text font-sans antialiased min-h-screen">
      <div className="max-w-4xl mx-auto pb-24">
        {/* Tab Strip */}
        <div className="sticky top-0 z-10 bg-background/90 backdrop-blur-md border-b border-clinical-border pt-4">
          <div className="flex overflow-x-auto no-scrollbar px-[20px] gap-6 items-center">
            <Link className="pb-3 border-b-2 border-transparent text-clinical-muted hover:text-clinical-text font-medium whitespace-nowrap text-sm transition-colors" href="/account">
              Profile
            </Link>
            <Link className="pb-3 border-b-2 border-clinical-gold text-clinical-text font-medium whitespace-nowrap text-sm" href="/account/subscriptions">
              Plans
            </Link>
            <Link className="pb-3 border-b-2 border-transparent text-clinical-muted hover:text-clinical-text font-medium whitespace-nowrap text-sm transition-colors" href="/account/orders">
              Orders
            </Link>
            <Link className="pb-3 border-b-2 border-transparent text-clinical-muted hover:text-clinical-text font-medium whitespace-nowrap text-sm transition-colors" href="/account/appointments">
              Consults
            </Link>
            <Link className="pb-3 border-b-2 border-transparent text-clinical-muted hover:text-clinical-text font-medium whitespace-nowrap text-sm transition-colors" href="/account/billing">
              Billing
            </Link>
            <Link className="pb-3 border-b-2 border-transparent text-clinical-muted hover:text-clinical-text font-medium whitespace-nowrap text-sm transition-colors" href="/account/addresses">
              Addresses
            </Link>
            <Link className="pb-3 border-b-2 border-transparent text-clinical-muted hover:text-clinical-text font-medium whitespace-nowrap text-sm transition-colors" href="/account/preferences">
              Preferences
            </Link>
            <Link className="pb-3 border-b-2 border-transparent text-clinical-muted hover:text-clinical-text font-medium whitespace-nowrap text-sm transition-colors" href="/account/wellness">
              Health
            </Link>
            <Link className="pb-3 border-b-2 border-transparent text-clinical-muted hover:text-clinical-text font-medium whitespace-nowrap text-sm transition-colors" href="/account/loyalty">
              Rewards
            </Link>
            <Link className="pb-3 border-b-2 border-transparent text-clinical-muted hover:text-clinical-text font-medium whitespace-nowrap text-sm transition-colors" href="/account/symptoms">
              Symptoms
            </Link>
            <Link className="pb-3 border-b-2 border-transparent text-clinical-muted hover:text-clinical-text font-medium whitespace-nowrap text-sm transition-colors" href="/account/history">
              History
            </Link>
          </div>
        </div>

        <div className="px-[20px] pt-[32px] flex flex-col gap-[16px]">
          {/* Credit Banner */}
          <div className="inline-flex items-center gap-2 bg-[#7D9E7E]/10 px-4 py-2 rounded-full self-start">
            <span className="material-symbols-outlined text-[18px] text-[#4F6B50]">redeem</span>
            <span className="text-sm font-medium text-[#4F6B50]">3 meal credits — skipped deliveries come back as credits</span>
          </div>

          {/* Subscription Cards */}
          <div className="flex flex-col gap-[16px] mt-4">
            {/* Card 1 (Active) */}
            <div className="bg-surface-container-lowest border border-clinical-border rounded-[24px] p-[20px] flex flex-col gap-4">
              <div className="flex justify-between items-start">
                <h2 className="font-headline-md text-[32px] leading-[38px] tracking-[-0.02em] font-bold md:text-[24px] md:leading-[32px] md:tracking-[-0.01em] md:font-semibold">Weekly · 5 meals / delivery</h2>
                <span className="bg-clinical-sage-bg text-clinical-sage px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide">Active</span>
              </div>
              <div className="flex flex-col gap-1">
                <p className="font-data-lg tabular-nums text-[20px] font-medium leading-[24px]">₹189 <span className="font-body-md text-[16px] font-normal leading-[24px] text-clinical-muted">/ delivery · 12:30–2:00 PM</span></p>
                <p className="text-sm text-clinical-muted">Next delivery: <span className="font-data-sm tabular-nums text-clinical-text text-[14px] font-medium leading-[18px]">Oct 24, 2023</span></p>
                <p className="text-sm text-clinical-text mt-1">Home - 123 Metabolic Way, Suite 400</p>
              </div>
              <div className="bg-[#7D9E7E]/10 px-4 py-3 rounded-xl text-sm text-[#4F6B50] flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px]">info</span>
                Plan change to Monthly · 6 meals takes effect next cycle.
              </div>
              <div className="pt-4 border-t border-clinical-border flex gap-4 mt-2">
                <button className="text-sm font-medium text-clinical-text hover:text-clinical-gold transition-colors">Pause</button>
                <button className="text-sm font-medium text-clinical-text hover:text-clinical-gold transition-colors">Change plan</button>
                <Link href="/meal-planner" className="text-sm font-medium text-clinical-text hover:text-clinical-gold transition-colors">Deliveries</Link>
              </div>
            </div>

            {/* Card 2 (Paused) */}
            <div className="bg-surface-container-lowest border border-clinical-border rounded-[24px] p-[20px] flex flex-col gap-4 opacity-75">
              <div className="flex justify-between items-start">
                <h2 className="font-headline-md text-[32px] leading-[38px] tracking-[-0.02em] font-bold md:text-[24px] md:leading-[32px] md:tracking-[-0.01em] md:font-semibold">Weekly · 5 meals / delivery</h2>
                <span className="border border-clinical-border text-clinical-muted px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide">Paused</span>
              </div>
              <div className="flex flex-col gap-1">
                <p className="font-data-lg tabular-nums text-[20px] font-medium leading-[24px]">₹189 <span className="font-body-md text-[16px] font-normal leading-[24px] text-clinical-muted">/ delivery</span></p>
                <p className="text-sm text-clinical-muted">Resumes: <span className="font-data-sm tabular-nums text-clinical-text text-[14px] font-medium leading-[18px]">Nov 14, 2023</span></p>
                <p className="text-sm text-clinical-text mt-1">Work - 456 Zenith Tower, Floor 12</p>
              </div>
              <div className="pt-4 border-t border-clinical-border flex gap-4 mt-2">
                <button className="text-sm font-medium text-clinical-gold hover:text-primary-container transition-colors">Resume</button>
                <button className="text-sm font-medium text-clinical-alert hover:opacity-80 transition-opacity">Cancel</button>
                <button className="text-sm font-medium text-clinical-text hover:text-clinical-gold transition-colors">Change plan</button>
                <button className="text-sm font-medium text-clinical-text hover:text-clinical-gold transition-colors">Deliveries</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
