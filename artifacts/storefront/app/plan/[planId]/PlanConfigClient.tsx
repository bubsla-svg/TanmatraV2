"use client";

import React, { useState } from "react";
import Link from "next/link";
import { SafeImage } from "@/components/primitives/SafeImage";

interface PlanConfigClientProps {
  plan: {
    id: string;
    name: string;
    promise: string;
    subtitle: string;
    clinical: boolean;
  };
}

export default function PlanConfigClient({ plan }: PlanConfigClientProps) {
  const [proteinTrack, setProteinTrack] = useState<"veg" | "egg" | "non-veg">("veg");
  const [billingCycle, setBillingCycle] = useState<"weekly" | "monthly">("monthly");

  return (
    <div className="bg-[#0A0A0A] text-[#F5F5F4] font-body-lg selection:bg-[#f2ca50] selection:text-[#111318] overflow-x-hidden min-h-screen">
      {/* Main Content Wrapper */}
      <main className="max-w-screen-xl mx-auto px-6 pt-8 pb-32">
        
        {/* Header Section */}
        <header className="mb-12 md:mb-24">
          <p className="text-[12px] font-bold text-[#f2ca50] mb-2 uppercase tracking-[0.2em] leading-none">Subscription Setup</p>
          <h1 className="text-[32px] md:text-[48px] font-semibold text-[#F5F5F4] mb-2 leading-[1.2] md:leading-[1.1] tracking-[-0.02em]">{plan.name} Protocol</h1>
          <p className="text-[18px] text-[#A3A3A3] leading-[1.6]">{plan.subtitle}</p>
        </header>

        {/* Stepper Indicators */}
        <div className="flex gap-4 mb-12">
          <div className="h-1 flex-1 bg-[#f2ca50] rounded-full"></div>
          <div className="h-1 flex-1 bg-[#353534] rounded-full"></div>
          <div className="h-1 flex-1 bg-[#353534] rounded-full"></div>
        </div>

        {/* Section 1: Protein Track */}
        <section className="mb-12 md:mb-24">
          <div className="flex items-center gap-3 mb-6">
            <span className="font-mono text-[14px] font-medium bg-[#201f1f] px-3 py-1 rounded-full border border-white/5">01</span>
            <h2 className="text-[24px] font-medium text-[#F5F5F4]">Select Protein Track</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Veg Card */}
            <button 
              onClick={() => setProteinTrack("veg")}
              className={`group relative flex flex-col text-left bg-[#171717] border rounded-3xl overflow-hidden transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-[#f2ca50] ${proteinTrack === "veg" ? "border-[#f2ca50] ring-2 ring-[#f2ca50]" : "border-white/5 hover:border-[#f2ca50]/50"}`}
            >
              <div className="h-64 w-full relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-t from-[#171717] to-transparent z-10"></div>
                <img 
                  alt="Vegetarian" 
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" 
                  src="https://lh3.googleusercontent.com/aida/AP1WRLsDqj-AKWLpHdH1xubRSnbsvM7NfZGH_oowX9d9dtN6V3qnO46d1NF5UpGe5oYWFsM1m2O1EeaV4wyYrL3YpFcEhdG3NiSdVr65kcdR0Zx2lnolQIHCc6mMuZ6otPQQSQ490i6Mzg7al3mWmaoKuRiDC-xR-wW04tOrP7eTqrsmVBs452f260i8af3bFUOxC7VlIidq0agScT3vs8Df1eVvGALUuQOgAFN6ZWGhvv7tTFyX-KVnIlhBx_U"
                />
              </div>
              <div className="p-6 relative z-20 -mt-12">
                <h3 className="text-[24px] font-medium text-[#F5F5F4]">Vegetarian</h3>
                <p className="text-[14px] text-[#A3A3A3] mt-1">Plant-based excellence with high-fiber grains.</p>
                <div className="mt-4 font-mono text-[14px] font-medium text-[#f2ca50] flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px]">full_hd</span>
                  <span>SOCIALLY CONSCIOUS</span>
                </div>
              </div>
            </button>

            {/* Egg Card */}
            <button 
              onClick={() => setProteinTrack("egg")}
              className={`group relative flex flex-col text-left bg-[#171717] border rounded-3xl overflow-hidden transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-[#f2ca50] ${proteinTrack === "egg" ? "border-[#f2ca50] ring-2 ring-[#f2ca50]" : "border-white/5 hover:border-[#f2ca50]/50"}`}
            >
              <div className="h-64 w-full relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-t from-[#171717] to-transparent z-10"></div>
                <div className="w-full h-full bg-[#201f1f] bg-cover bg-center" style={{ backgroundImage: "url('https://lh3.googleusercontent.com/aida-public/AB6AXuAvTstGIgg2J7d6ljDlrHMUXpyGHB5pc9dKh3eCQvdjfcLqDFa88ekDPucVo-LozhZpTTiTK6f85uXL3ZR8_CBeSxa6upRE3PPPgVOmfPpMuQ9-9rpZ5Cq7pRsuFJ67y98sQ8ZpMwGU8NVTEEUU3sKbz2DyNEw7wCuUvin2_oQf7dcu6dZxVskL8dnV0Iz86Q8xkcb2b4tJEAqsv5KoJ-NncLz0kOFC2RdO1za3SbK9_3cJwTxytEHepQWTwl7gUs7mBVewgeu2nQY')" }}></div>
              </div>
              <div className="p-6 relative z-20 -mt-12">
                <h3 className="text-[24px] font-medium text-[#F5F5F4]">Eggitarian</h3>
                <p className="text-[14px] text-[#A3A3A3] mt-1">Bio-available proteins with organic farm eggs.</p>
                <div className="mt-4 font-mono text-[14px] font-medium text-[#f2ca50] flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px]">egg</span>
                  <span>MAX ABSORPTION</span>
                </div>
              </div>
            </button>

            {/* Non-Veg Card */}
            <button 
              onClick={() => setProteinTrack("non-veg")}
              className={`group relative flex flex-col text-left bg-[#171717] border rounded-3xl overflow-hidden transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-[#f2ca50] ${proteinTrack === "non-veg" ? "border-[#f2ca50] ring-2 ring-[#f2ca50]" : "border-white/5 hover:border-[#f2ca50]/50"}`}
            >
              <div className="h-64 w-full relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-t from-[#171717] to-transparent z-10"></div>
                <div className="w-full h-full bg-[#201f1f] bg-cover bg-center" style={{ backgroundImage: "url('https://lh3.googleusercontent.com/aida-public/AB6AXuBp7bKfbKZ20xe0piLuc-rPO8ojGEZDdRVt5apus_R7wy3wTXFs4_mR5_3mvK6YGnxkSPjizVylMSftOGjwaWgkFTBIZlcgPDOv5m-_rxs0ziYds7m796gltDpv-ZsUdXk_QGxNj4E3VGjCL2XfRIV5MAe1F3K_Yrpf9cE1xdrxLXfGpUP8Zlriko2Qr42UgP0jWT4d1pPqnntypSyFyTuYx3YgwFog2sCHkjK1WU08xTATBCMV3nvtBjVb3CtF8JFC8sumePEZvvY')" }}></div>
              </div>
              <div className="p-6 relative z-20 -mt-12">
                <h3 className="text-[24px] font-medium text-[#F5F5F4]">Non-Vegetarian</h3>
                <p className="text-[14px] text-[#A3A3A3] mt-1">Premium lean meats for metabolic endurance.</p>
                <div className="mt-4 font-mono text-[14px] font-medium text-[#f2ca50] flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px]">restaurant</span>
                  <span>COMPLETE PROFILE</span>
                </div>
              </div>
            </button>
          </div>
        </section>

        {/* Section 2: Billing Cycle */}
        <section className="mb-12 md:mb-24">
          <div className="flex items-center gap-3 mb-6">
            <span className="font-mono text-[14px] font-medium bg-[#201f1f] px-3 py-1 rounded-full border border-white/5">02</span>
            <h2 className="text-[24px] font-medium text-[#F5F5F4]">Billing Cycle</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl">
            {/* Weekly */}
            <div 
              onClick={() => setBillingCycle("weekly")}
              className={`cursor-pointer group flex items-center justify-between p-6 bg-[#171717] border rounded-2xl transition-all duration-200 ${billingCycle === "weekly" ? "border-[#f2ca50]" : "border-white/5 hover:border-[#f2ca50]/40"}`}
            >
              <div className="flex items-center gap-4">
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${billingCycle === "weekly" ? "border-[#f2ca50]" : "border-white/5"}`}>
                  <div className={`w-2.5 h-2.5 rounded-full bg-[#f2ca50] transition-opacity ${billingCycle === "weekly" ? "opacity-100" : "opacity-0"}`}></div>
                </div>
                <div>
                  <p className="text-[24px] font-medium text-[#F5F5F4] leading-none">Weekly</p>
                  <p className="text-[14px] text-[#A3A3A3] mt-1">Billed every 7 days</p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-mono text-[24px] font-medium text-[#F5F5F4]">₹3,200</p>
                <p className="font-mono text-[12px] font-medium text-[#A3A3A3]">PER WEEK</p>
              </div>
            </div>

            {/* Monthly */}
            <div 
              onClick={() => setBillingCycle("monthly")}
              className={`cursor-pointer group flex items-center justify-between p-6 bg-[#171717] border rounded-2xl transition-all duration-200 ${billingCycle === "monthly" ? "border-[#f2ca50]" : "border-white/5 hover:border-[#f2ca50]/40"}`}
            >
              <div className="flex items-center gap-4">
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${billingCycle === "monthly" ? "border-[#f2ca50]" : "border-white/5"}`}>
                  <div className={`w-2.5 h-2.5 rounded-full bg-[#f2ca50] transition-opacity ${billingCycle === "monthly" ? "opacity-100" : "opacity-0"}`}></div>
                </div>
                <div>
                  <p className="text-[24px] font-medium text-[#F5F5F4] leading-none">Monthly</p>
                  <p className="text-[14px] text-[#7D9E7E] mt-1">Most Popular • Save 15%</p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-mono text-[24px] font-medium text-[#F5F5F4]">₹12,600</p>
                <p className="font-mono text-[12px] font-medium text-[#A3A3A3]">PER MONTH</p>
              </div>
            </div>
          </div>
        </section>

        {/* Section 3: Order Summary */}
        <section className="max-w-2xl">
          <div className="flex items-center gap-3 mb-6">
            <span className="material-symbols-outlined text-[#f2ca50]">receipt_long</span>
            <h2 className="text-[24px] font-medium text-[#F5F5F4]">Current Quote</h2>
          </div>
          <div className="bg-[#171717] border border-white/5 rounded-3xl p-8 space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-[#A3A3A3] text-[18px]">Subtotal</span>
              <span className="font-mono text-[18px] font-medium text-[#F5F5F4] tabular-nums">
                {billingCycle === "monthly" ? "₹12,600" : "₹3,200"}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[#A3A3A3] text-[18px]">GST</span>
              <span className="font-mono text-[18px] font-medium text-[#F5F5F4] uppercase">Incl.</span>
            </div>
            <div className="flex justify-between items-center py-2 border-y border-white/5">
              <span className="text-[#7D9E7E] text-[18px] flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px]">verified</span>
                Credit Applied
              </span>
              <span className="font-mono text-[18px] font-medium text-[#7D9E7E] tabular-nums">
                {billingCycle === "monthly" ? "-₹500" : "₹0"}
              </span>
            </div>
            <div className="flex justify-between items-center pt-2">
              <span className="text-[24px] font-medium text-[#F5F5F4]">Estimated Total</span>
              <span className="font-mono text-[32px] font-medium text-[#f2ca50] tabular-nums tracking-tighter">
                {billingCycle === "monthly" ? "₹12,100" : "₹3,200"}
              </span>
            </div>
          </div>

          {/* Policy Microcopy */}
          <div className="mt-6 flex items-start gap-3 px-4">
            <span className="material-symbols-outlined text-[#A3A3A3] text-[20px]">info</span>
            <p className="text-[#A3A3A3] text-[14px] italic">
              All protocols are clinical-grade and managed via the Metabolic OS. Cancellations require 48-hour notice prior to the next billing cycle.
            </p>
          </div>
        </section>
      </main>

      {/* Sticky Bottom Bar */}
      <div className="fixed bottom-0 left-0 w-full bg-[#171717]/70 backdrop-blur-md border-t border-white/5 z-[60] pb-safe">
        <div className="max-w-screen-xl mx-auto px-6 h-24 flex items-center justify-between gap-6">
          <div className="flex flex-col">
            <span className="font-mono text-[12px] font-medium text-[#A3A3A3] uppercase tracking-widest">Total Payable</span>
            <span className="font-mono text-[28px] font-medium text-[#F5F5F4] tabular-nums leading-tight">
              {billingCycle === "monthly" ? "₹12,100" : "₹3,200"}
            </span>
          </div>
          {/* Must carry the plan (and the cycle the customer actually picked):
              /checkout prices from ?plan= and bounces a bare visit to /plans. */}
          <Link href={`/checkout?plan=${plan.id}&cycle=${billingCycle}`} className="flex-1 md:flex-none md:min-w-[280px] bg-[#f2ca50] text-[#111318] font-bold text-[12px] py-4 rounded-full flex items-center justify-center gap-2 transition-all duration-200 active:scale-[0.98] hover:shadow-[0_0_20px_rgba(242,202,80,0.3)] group tracking-[0.05em] uppercase">
            CONTINUE TO PAYMENT
            <span className="material-symbols-outlined text-[20px] transition-transform group-hover:translate-x-1">arrow_forward</span>
          </Link>
        </div>
        {/* Safety Margin for System Bottom Nav */}
        <div className="h-16 w-full"></div>
      </div>
    </div>
  );
}
