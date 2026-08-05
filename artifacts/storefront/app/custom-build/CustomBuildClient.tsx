"use client";

import React, { useState } from "react";
import Link from "next/link";
import { SafeImage } from "@/components/primitives/SafeImage";

export default function CustomBuildClient() {
  const [selectedBase, setSelectedBase] = useState<string>("salmon");
  const [selectedBread, setSelectedBread] = useState<string>("sourdough");
  const [selectedEnhancements, setSelectedEnhancements] = useState<string[]>(["greens", "avocado"]);

  const toggleEnhancement = (id: string) => {
    setSelectedEnhancements(prev => 
      prev.includes(id) ? prev.filter(e => e !== id) : [...prev, id]
    );
  };

  const calculateTotal = () => {
    let basePrice = 750; // Salmon default
    if (selectedBase === "steak") basePrice = 890;
    if (selectedBase === "chicken") basePrice = 620;

    let customizations = 0;
    if (selectedBread === "multigrain") customizations += 15;
    if (selectedEnhancements.includes("greens")) customizations += 45;
    if (selectedEnhancements.includes("avocado")) customizations += 60;
    if (selectedEnhancements.includes("egg")) customizations += 30;

    return { base: basePrice, custom: customizations, total: basePrice + customizations };
  };

  const prices = calculateTotal();

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-[#e5e2e1] font-body-base selection:bg-[#f2ca50] selection:text-[#111318] flex justify-center pb-safe pt-8 md:pt-16">
      <main className="w-full max-w-[1280px] px-5 md:px-8 flex flex-col gap-[clamp(3rem,8vw,6rem)]">
        
        {/* Top Section: Stepper */}
        <header className="w-full flex flex-col items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-[#f2ca50] opacity-60"></div>
            <div className="w-3 h-3 rounded-full bg-[#d4af37] shadow-[0_0_12px_rgba(212,175,55,0.4)] animate-pulse"></div>
            <div className="w-2 h-2 rounded-full bg-[#353534]"></div>
            <div className="w-2 h-2 rounded-full bg-[#353534]"></div>
          </div>
          <p className="text-[12px] font-semibold text-[#A3A3A3] uppercase tracking-widest leading-none">Step 2 of 4: Custom Build</p>
        </header>

        {/* Main Layout: 2 Column Stack on Mobile, Grid on Desktop */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
          
          {/* Left Column: Dish Selection & Customization */}
          <section className="col-span-1 md:col-span-7 flex flex-col gap-10">
            
            {/* Clinical Dish List */}
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <h2 className="text-[32px] font-semibold text-[#F5F5F4] mb-1 leading-[1.2] tracking-[-0.01em]">Select Primary Base</h2>
              </div>

              {/* Wearable Signal Callout */}
              <div className="p-3.5 bg-[#171717] border border-[#d4af37]/30 rounded-2xl flex items-center justify-between gap-3 text-xs text-[#d0c5af]">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[#d4af37] text-lg">watch</span>
                  <span><strong>Apple Health Telemetry:</strong> High active burn (480 kcal) — recommending high-protein recovery base.</span>
                </div>
                <Link href="/account/connections" className="text-[#f2ca50] text-[11px] font-semibold hover:underline shrink-0">
                  Settings
                </Link>
              </div>

              <div className="flex flex-col gap-3 max-h-[442px] overflow-y-auto no-scrollbar pb-4 pr-2">
                
                {/* Salmon */}
                <div 
                  onClick={() => setSelectedBase("salmon")}
                  className={`flex items-center gap-4 p-3 rounded-2xl bg-[#131313] border relative overflow-hidden cursor-pointer group transition-all duration-300 ${selectedBase === "salmon" ? "border-[#d4af37]" : "border-white/5 hover:border-[#4d4635]"}`}
                >
                  {selectedBase === "salmon" && <div className="absolute inset-0 bg-[#f2ca50] opacity-[0.03] pointer-events-none"></div>}
                  <div className={`w-20 h-20 shrink-0 relative rounded-xl overflow-hidden border border-white/5 shadow-md transition-all duration-300 ${selectedBase !== "salmon" ? "grayscale-[0.2] group-hover:grayscale-0" : ""}`}>
                    <SafeImage src="https://lh3.googleusercontent.com/aida/AP1WRLsDqj-AKWLpHdH1xubRSnbsvM7NfZGH_oowX9d9dtN6V3qnO46d1NF5UpGe5oYWFsM1m2O1EeaV4wyYrL3YpFcEhdG3NiSdVr65kcdR0Zx2lnolQIHCc6mMuZ6otPQQSQ490i6Mzg7al3mWmaoKuRiDC-xR-wW04tOrP7eTqrsmVBs452f260i8af3bFUOxC7VlIidq0agScT3vs8Df1eVvGALUuQOgAFN6ZWGhvv7tTFyX-KVnIlhBx_U" alt="Wild Salmon Reset" aspectRatio="1/1" />
                  </div>
                  <div className="flex flex-col flex-grow justify-center gap-1">
                    <div className="flex justify-between items-start w-full">
                      <h3 className={`text-[16px] font-medium transition-colors ${selectedBase === "salmon" ? "text-[#F5F5F4]" : "text-[#A3A3A3] group-hover:text-[#F5F5F4]"}`}>Wild Salmon Reset</h3>
                      <span className={`font-mono text-[13px] font-medium tabular-nums ${selectedBase === "salmon" ? "text-[#d0c5af]" : "text-[#A3A3A3]"}`}>₹750</span>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="font-mono text-[11px] font-medium text-[#A3A3A3] bg-[#2a2a2a] px-2 py-0.5 rounded-full border border-white/5">32P</span>
                      <span className="font-mono text-[11px] font-medium text-[#A3A3A3] bg-[#2a2a2a] px-2 py-0.5 rounded-full border border-white/5">12F</span>
                      <span className="font-mono text-[11px] font-medium text-[#A3A3A3] bg-[#2a2a2a] px-2 py-0.5 rounded-full border border-white/5">450 kcal</span>
                    </div>
                  </div>
                  {selectedBase === "salmon" && <span className="material-symbols-outlined text-[#d4af37] absolute right-4 top-1/2 -translate-y-1/2">check_circle</span>}
                </div>

                {/* Steak */}
                <div 
                  onClick={() => setSelectedBase("steak")}
                  className={`flex items-center gap-4 p-3 rounded-2xl bg-[#131313] border relative overflow-hidden cursor-pointer group transition-all duration-300 ${selectedBase === "steak" ? "border-[#d4af37]" : "border-white/5 hover:border-[#4d4635]"}`}
                >
                  {selectedBase === "steak" && <div className="absolute inset-0 bg-[#f2ca50] opacity-[0.03] pointer-events-none"></div>}
                  <div className={`w-20 h-20 shrink-0 relative rounded-xl overflow-hidden border border-white/5 shadow-md transition-all duration-300 ${selectedBase !== "steak" ? "grayscale-[0.2] group-hover:grayscale-0" : ""}`}>
                    <SafeImage src="https://lh3.googleusercontent.com/aida-public/AB6AXuDrrbLvwrAO0cMzz3F85Nevjczx7844quMz7suGAuyTYBBPwdGrklVmlj6icV0rpsU1g2x0SYqDZxQ0SfPF6hixW8jg8LUaR8ouq9Ws7fOSoITvXSzbCQkSXL6IhpaT3vHnEixL9vAxubosRXc1DdOJhbMhtt5nQWl9_vQ26PL_iigDYUWzS31zb39NU4kbVVBIgLEEuYnUszZzlcjTyCMBc4vYtIIx4nsorR1DTO5BjD-9KSXEx1QRSCHMIxl1NkakcGCznkoW-0U" alt="Grass-fed Steak" aspectRatio="1/1" />
                  </div>
                  <div className="flex flex-col flex-grow justify-center gap-1">
                    <div className="flex justify-between items-start w-full">
                      <h3 className={`text-[16px] font-medium transition-colors ${selectedBase === "steak" ? "text-[#F5F5F4]" : "text-[#A3A3A3] group-hover:text-[#F5F5F4]"}`}>Grass-fed Steak & Brassicas</h3>
                      <span className={`font-mono text-[13px] font-medium tabular-nums ${selectedBase === "steak" ? "text-[#d0c5af]" : "text-[#A3A3A3]"}`}>₹890</span>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="font-mono text-[11px] font-medium text-[#353534] bg-[#201f1f] px-2 py-0.5 rounded-full border border-white/5">45P</span>
                      <span className="font-mono text-[11px] font-medium text-[#353534] bg-[#201f1f] px-2 py-0.5 rounded-full border border-white/5">22F</span>
                      <span className="font-mono text-[11px] font-medium text-[#353534] bg-[#201f1f] px-2 py-0.5 rounded-full border border-white/5">580 kcal</span>
                    </div>
                  </div>
                  {selectedBase === "steak" && <span className="material-symbols-outlined text-[#d4af37] absolute right-4 top-1/2 -translate-y-1/2">check_circle</span>}
                </div>

                {/* Chicken */}
                <div 
                  onClick={() => setSelectedBase("chicken")}
                  className={`flex items-center gap-4 p-3 rounded-2xl bg-[#131313] border relative overflow-hidden cursor-pointer group transition-all duration-300 ${selectedBase === "chicken" ? "border-[#d4af37]" : "border-white/5 hover:border-[#4d4635]"}`}
                >
                  {selectedBase === "chicken" && <div className="absolute inset-0 bg-[#f2ca50] opacity-[0.03] pointer-events-none"></div>}
                  <div className={`w-20 h-20 shrink-0 relative rounded-xl overflow-hidden border border-white/5 shadow-md transition-all duration-300 ${selectedBase !== "chicken" ? "grayscale-[0.2] group-hover:grayscale-0" : ""}`}>
                    <SafeImage src="https://lh3.googleusercontent.com/aida-public/AB6AXuDbvizzlurLWsUz1n6cVo-nJ5gBuh3lc4Pz9Ih2kXy8MJkFuUUx2AwzV8LnFKkWpJOi12X9QjaKObwl2Gorq4TWt9k_ueTbV7sAAjLQco0rZss0e-TYC4vHAGsUKU5UH4Olq53Z6UiwwBuEHgjeor_SPMVVGri2cRBA02DNnoY9_cvuETp1Uaquj1C03jspv2K6K4kiAW2mNR8O3x-n47TpTWe7TdnrdiFqBuces_8DSNiZ3x4SyorKdfbjYQpRpD7uiGGLNsgiHAk" alt="Turmeric Chicken" aspectRatio="1/1" />
                  </div>
                  <div className="flex flex-col flex-grow justify-center gap-1">
                    <div className="flex justify-between items-start w-full">
                      <h3 className={`text-[16px] font-medium transition-colors ${selectedBase === "chicken" ? "text-[#F5F5F4]" : "text-[#A3A3A3] group-hover:text-[#F5F5F4]"}`}>Turmeric Chicken & Quinoa</h3>
                      <span className={`font-mono text-[13px] font-medium tabular-nums ${selectedBase === "chicken" ? "text-[#d0c5af]" : "text-[#A3A3A3]"}`}>₹620</span>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="font-mono text-[11px] font-medium text-[#353534] bg-[#201f1f] px-2 py-0.5 rounded-full border border-white/5">38P</span>
                      <span className="font-mono text-[11px] font-medium text-[#353534] bg-[#201f1f] px-2 py-0.5 rounded-full border border-white/5">9F</span>
                      <span className="font-mono text-[11px] font-medium text-[#353534] bg-[#201f1f] px-2 py-0.5 rounded-full border border-white/5">410 kcal</span>
                    </div>
                  </div>
                  {selectedBase === "chicken" && <span className="material-symbols-outlined text-[#d4af37] absolute right-4 top-1/2 -translate-y-1/2">check_circle</span>}
                </div>

              </div>
            </div>

            <div className="h-px w-full bg-white/5 my-2"></div>

            {/* Customization Section */}
            <div className="flex flex-col gap-8">
              {/* Group 1: Bread Type */}
              <div className="flex flex-col gap-4">
                <div className="flex justify-between items-end">
                  <h3 className="text-[16px] font-medium text-[#F5F5F4]">Choose Bread Type</h3>
                  <span className="text-[12px] font-semibold text-[#A3A3A3] uppercase tracking-[0.05em] leading-none">Required</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <button 
                    onClick={() => setSelectedBread("sourdough")}
                    className={`flex items-center justify-center py-3 px-4 rounded-full font-medium transition-all duration-200 active:scale-[0.98] ${selectedBread === "sourdough" ? "bg-[#d4af37] text-[#111318] shadow-[0_0_15px_rgba(212,175,55,0.15)]" : "bg-transparent border border-white/5 text-[#F5F5F4] hover:bg-[#1c1b1b]"}`}
                  >
                    Sourdough (Included)
                  </button>
                  <button 
                    onClick={() => setSelectedBread("multigrain")}
                    className={`flex items-center justify-center py-3 px-4 rounded-full font-medium transition-all duration-200 active:scale-[0.98] ${selectedBread === "multigrain" ? "bg-[#d4af37] text-[#111318] shadow-[0_0_15px_rgba(212,175,55,0.15)]" : "bg-transparent border border-white/5 text-[#F5F5F4] hover:bg-[#1c1b1b]"}`}
                  >
                    Multigrain (+₹15)
                  </button>
                </div>
              </div>

              {/* Group 2: Add-ons */}
              <div className="flex flex-col gap-4">
                <div className="flex justify-between items-end">
                  <h3 className="text-[16px] font-medium text-[#F5F5F4]">Enhancements</h3>
                  <span className="text-[12px] font-semibold text-[#A3A3A3] uppercase tracking-[0.05em] leading-none">Optional</span>
                </div>
                <div className="flex flex-wrap gap-3">
                  <button 
                    onClick={() => toggleEnhancement("greens")}
                    className={`flex items-center gap-2 py-2.5 px-4 rounded-full font-medium transition-all duration-200 active:scale-[0.98] ${selectedEnhancements.includes("greens") ? "bg-[#d4af37] text-[#111318] shadow-[0_0_15px_rgba(212,175,55,0.15)]" : "bg-transparent border border-white/5 text-[#F5F5F4] hover:bg-[#1c1b1b]"}`}
                  >
                    <span className="material-symbols-outlined text-[18px]">{selectedEnhancements.includes("greens") ? "check" : "add"}</span>
                    Extra Greens (+₹45)
                  </button>
                  <button 
                    onClick={() => toggleEnhancement("avocado")}
                    className={`flex items-center gap-2 py-2.5 px-4 rounded-full font-medium transition-all duration-200 active:scale-[0.98] ${selectedEnhancements.includes("avocado") ? "bg-[#d4af37] text-[#111318] shadow-[0_0_15px_rgba(212,175,55,0.15)]" : "bg-transparent border border-white/5 text-[#F5F5F4] hover:bg-[#1c1b1b]"}`}
                  >
                    <span className="material-symbols-outlined text-[18px]">{selectedEnhancements.includes("avocado") ? "check" : "add"}</span>
                    Avocado (+₹60)
                  </button>
                  <button 
                    onClick={() => toggleEnhancement("egg")}
                    className={`flex items-center gap-2 py-2.5 px-4 rounded-full font-medium transition-all duration-200 active:scale-[0.98] ${selectedEnhancements.includes("egg") ? "bg-[#d4af37] text-[#111318] shadow-[0_0_15px_rgba(212,175,55,0.15)]" : "bg-transparent border border-white/5 text-[#F5F5F4] hover:bg-[#1c1b1b]"}`}
                  >
                    <span className="material-symbols-outlined text-[18px]">{selectedEnhancements.includes("egg") ? "check" : "add"}</span>
                    Soft Egg (+₹30)
                  </button>
                </div>
              </div>
            </div>
          </section>

          {/* Right Column: Order Summary Card */}
          <aside className="col-span-1 md:col-span-5 md:sticky md:top-24">
            <div className="bg-[#171717] rounded-3xl border border-white/5 p-6 flex flex-col gap-6 shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-[#f2ca50] rounded-full blur-[80px] opacity-10 pointer-events-none"></div>
              
              <div className="flex flex-col gap-2 relative z-10">
                <h3 className="text-[24px] font-semibold text-[#F5F5F4] tracking-tight leading-[1.2]">
                  {selectedBase === "salmon" && "Wild Salmon Reset"}
                  {selectedBase === "steak" && "Grass-fed Steak & Brassicas"}
                  {selectedBase === "chicken" && "Turmeric Chicken & Quinoa"}
                </h3>
                <p className="text-[14px] text-[#A3A3A3] leading-relaxed">
                  Customised: {selectedBread === "sourdough" ? "Sourdough" : "Multigrain"} 
                  {selectedEnhancements.includes("greens") ? " + Extra Greens" : ""}
                  {selectedEnhancements.includes("avocado") ? " + Avocado" : ""}
                  {selectedEnhancements.includes("egg") ? " + Soft Egg" : ""}
                </p>
              </div>

              <div className="h-px w-full bg-white/5 relative z-10"></div>

              <div className="flex flex-col gap-3 font-mono text-[13px] font-medium tabular-nums relative z-10">
                <div className="flex justify-between items-center text-[#A3A3A3]">
                  <span>Base</span>
                  <span>₹{prices.base}</span>
                </div>
                <div className="flex justify-between items-center text-[#A3A3A3]">
                  <span>Customisations</span>
                  <span>₹{prices.custom}</span>
                </div>
                <div className="flex justify-between items-center pt-3 border-t border-white/5 mt-1">
                  <span className="text-[#F5F5F4] font-bold text-[16px]">Total</span>
                  <span className="text-[#d4af37] font-bold text-[16px]">₹{prices.total}</span>
                </div>
              </div>

              <div className="flex items-start gap-3 bg-[#1c1b1b] p-4 rounded-xl border border-white/5 relative z-10">
                <span className="material-symbols-outlined text-[#7D9E7E] text-[20px]">info</span>
                <p className="text-[14px] text-[#7D9E7E] leading-snug">
                  Your selections travel with the order to checkout. Macros will dynamically update in your vault.
                </p>
              </div>

              <div className="flex flex-col gap-3 mt-4 relative z-10">
                <Link href="/cart" className="w-full py-4 rounded-full bg-[#d4af37] text-[#111318] text-[16px] font-bold flex items-center justify-center gap-2 hover:bg-[#f2ca50] transition-colors active:scale-[0.98]">
                  Add to cart
                  <span className="material-symbols-outlined text-[20px]">arrow_forward</span>
                </Link>
                <button className="w-full py-4 rounded-full bg-transparent border border-white/5 text-[#F5F5F4] text-[16px] hover:bg-[#0e0e0e] transition-colors flex items-center justify-center gap-2 active:scale-[0.98]">
                  <span className="material-symbols-outlined text-[20px]">bookmark</span>
                  Save to Vault
                </button>
              </div>
            </div>
          </aside>

        </div>
      </main>
    </div>
  );
}
