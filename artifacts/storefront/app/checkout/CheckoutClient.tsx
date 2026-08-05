"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function CheckoutClient() {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [isFocused, setIsFocused] = useState(false);

  // Hardcode random order ID for the prototype simulation
  const handlePayNow = () => {
    router.push("/order/confirmed/ORD-8F2C1A");
  };

  return (
    <div className="bg-[#0A0A0A] text-[#F5F5F4] min-h-[max(884px,100dvh)] font-body-lg text-body-lg overflow-x-hidden selection:bg-primary/30">
      {/* TopAppBar */}
      <header className="fixed top-0 w-full z-50 bg-glass backdrop-blur-md border-b border-hairline">
        <div className="flex items-center px-gutter h-16 max-w-[1280px] mx-auto">
          <button
            onClick={() => router.back()}
            className="mr-4 hover:opacity-80 transition-opacity scale-[0.98] active:scale-95 transition-transform duration-200"
          >
            <span className="material-symbols-outlined text-primary text-[28px]">arrow_back</span>
          </button>
          <h1 className="font-headline-md text-headline-md text-on-surface">Checkout</h1>
        </div>
      </header>

      <main className="pt-24 pb-48 px-gutter max-w-lg mx-auto min-h-screen">
        {/* Step 01: Progress Dots */}
        <section className="flex justify-center items-center gap-3 mb-10">
          <div className="w-2.5 h-2.5 rounded-full bg-primary shadow-[0_0_8px_rgba(242,202,80,0.4)]"></div>
          <div className="w-1.5 h-1.5 rounded-full bg-surface-container-highest"></div>
          <div className="w-1.5 h-1.5 rounded-full bg-surface-container-highest"></div>
        </section>

        {/* Step 02: Identity Island (PhoneAuth) */}
        <section className="mb-10">
          <div className="bg-surface rounded-[2rem] border border-hairline p-8 shadow-black/40">
            <div className="flex items-center gap-3 mb-6">
              <span className="material-symbols-outlined text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>fingerprint</span>
              <h2 className="font-headline-md text-headline-md text-ink-primary">Identity</h2>
            </div>
            <p className="text-ink-secondary mb-8 font-body-sm">Enter mobile to continue</p>
            
            <div className="relative group">
              <div 
                className={`flex items-center bg-surface-container-low border rounded-xl px-4 py-3 transition-colors ${
                  isFocused ? "border-primary shadow-[0_0_12px_rgba(212,175,55,0.1)]" : "border-hairline"
                }`}
              >
                <span className="font-clinical-data text-clinical-data text-primary mr-3">+91</span>
                <div className="h-4 w-[1px] bg-hairline mr-4"></div>
                <input 
                  className="bg-transparent border-none p-0 w-full font-clinical-data text-clinical-data text-ink-primary placeholder:text-surface-container-highest focus:ring-0" 
                  placeholder="000 000 0000" 
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  onFocus={() => setIsFocused(true)}
                  onBlur={() => setIsFocused(false)}
                />
              </div>
            </div>

            <div className="mt-8 flex justify-end">
              <button className="font-label-caps text-label-caps text-primary tracking-widest uppercase hover:opacity-80 transition-opacity flex items-center gap-2">
                Send OTP
                <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
              </button>
            </div>
          </div>
        </section>

        {/* Step 03: Order Summary */}
        <section className="mb-20">
          <h3 className="font-label-caps text-label-caps text-ink-secondary mb-6 tracking-[0.2em] uppercase">Current Order</h3>
          <div className="space-y-6">
            {/* Item 1 */}
            <div className="flex justify-between items-start">
              <div className="flex flex-col">
                <span className="font-body-lg text-ink-primary">Keto-Cleanse Bowl</span>
                <span className="text-ink-secondary text-body-sm font-light mt-1">x 1</span>
              </div>
              <span className="font-clinical-data text-clinical-data text-on-surface">₹1450</span>
            </div>
            
            <div className="h-px w-full bg-hairline"></div>
            
            {/* Item 2 */}
            <div className="flex justify-between items-start">
              <div className="flex flex-col">
                <span className="font-body-lg text-ink-primary">Miso Glazed Tempeh</span>
                <span className="text-ink-secondary text-body-sm font-light mt-1">x 1</span>
              </div>
              <span className="font-clinical-data text-clinical-data text-on-surface">₹1200</span>
            </div>
            
            {/* Subtotal */}
            <div className="pt-8 flex flex-col gap-2">
              <div className="flex justify-between items-center">
                <span className="font-headline-md text-headline-md text-ink-primary">Subtotal</span>
                <span className="font-clinical-data text-[20px] font-bold text-primary">₹2650</span>
              </div>
              <p className="text-surface-container-highest font-body-sm italic text-right">Server bills the final total</p>
            </div>
          </div>
        </section>
      </main>

      {/* Sticky Footer Container */}
      <div className="fixed bottom-0 left-0 w-full z-50">
        {/* Sticky Footer Action Bar */}
        <div className="bg-glass backdrop-blur-md border-t border-hairline py-4 px-gutter">
          <div className="max-w-[1280px] mx-auto flex items-center justify-between">
            <div className="flex flex-col">
              <span className="font-label-caps text-[10px] text-ink-secondary tracking-widest uppercase mb-0.5">Est. Total</span>
              <div className="flex items-baseline gap-1">
                <span className="font-headline-md font-bold text-ink-primary">₹</span>
                <span className="font-clinical-data text-headline-md font-bold text-ink-primary">2650</span>
              </div>
            </div>
            {/* PAY CTA */}
            <button 
              className={`px-10 py-4 rounded-full font-label-caps text-label-caps uppercase tracking-widest transition-all ${
                phone.length >= 10 
                  ? "bg-primary text-ink-on-gold shadow-[0_8px_24px_-8px_rgba(212,175,55,0.4)] hover:opacity-90"
                  : "bg-primary text-ink-on-gold opacity-50 grayscale cursor-not-allowed shadow-[0_8px_24px_-8px_rgba(212,175,55,0.4)]"
              }`}
              disabled={phone.length < 10}
              onClick={handlePayNow}
            >
              Pay Now
            </button>
          </div>
        </div>

        {/* BottomNavBar (Predicted Shared Component - Visual Only) */}
        <nav className="h-[4rem] bg-surface border-t border-hairline flex justify-around items-center px-4 pb-safe shadow-black/40">
          <div className="flex flex-col items-center justify-center text-ink-secondary opacity-40">
            <span className="material-symbols-outlined mb-1">restaurant_menu</span>
            <span className="font-label-caps text-[10px]">Plan</span>
          </div>
          <div className="flex flex-col items-center justify-center text-ink-secondary opacity-40">
            <span className="material-symbols-outlined mb-1">outdoor_grill</span>
            <span className="font-label-caps text-[10px]">Kitchen</span>
          </div>
          <div className="flex flex-col items-center justify-center text-ink-secondary opacity-40">
            <span className="material-symbols-outlined mb-1">biotech</span>
            <span className="font-label-caps text-[10px]">Labs</span>
          </div>
          <div className="flex flex-col items-center justify-center text-ink-secondary opacity-40">
            <span className="material-symbols-outlined mb-1">person</span>
            <span className="font-label-caps text-[10px]">Profile</span>
          </div>
        </nav>
      </div>
    </div>
  );
}
