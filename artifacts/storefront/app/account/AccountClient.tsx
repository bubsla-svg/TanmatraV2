"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
export default function AccountClient() {
    const [scrolled, setScrolled] = useState(false);

    useEffect(() => {
        const handleScroll = () => {
            setScrolled(window.scrollY > 10);
        };
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    return (
        <div className="min-h-screen bg-canvas pb-24 selection:bg-primary/20 selection:text-primary">
            {/* Top Navigation */}
            <header className={`sticky top-0 z-50 transition-all duration-300 ${scrolled ? 'shadow-lg bg-glass/95 backdrop-blur-md border-b border-hairline' : 'bg-transparent'}`}>
                <div className="flex items-center justify-between px-gutter py-4 max-w-md mx-auto">
                    <div className="flex flex-col">
                        <span className="font-label-caps text-label-caps text-ink-secondary">GUEST PORTAL</span>
                        <h1 className="font-display text-display text-on-surface tracking-tight mt-1">Hello, Guest</h1>
                    </div>
                    <button className="h-10 w-10 rounded-full border border-hairline flex items-center justify-center bg-surface hover:bg-surface-elevated transition-colors text-on-surface">
                        <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 0, 'wght' 300" }}>notifications</span>
                    </button>
                </div>
            </header>

            <main className="px-gutter pt-6 max-w-md mx-auto space-y-8">
                
                {/* Active Status (Live Order) */}
                <section>
                    <div className="flex items-center gap-2 mb-4">
                        <span className="w-2 h-2 rounded-full bg-sage-signal animate-pulse"></span>
                        <h2 className="font-label-caps text-label-caps text-ink-secondary tracking-widest">LIVE NOW</h2>
                    </div>
                    <div className="rounded-2xl border border-hairline bg-surface p-5 shadow-black/40 overflow-hidden relative group transition-all duration-200 active:scale-[0.98]">
                        {/* Decorative background accent */}
                        <div className="absolute top-0 right-0 w-32 h-32 bg-sage-signal/10 rounded-bl-full blur-2xl"></div>
                        
                        <div className="relative z-10 flex justify-between items-start mb-6">
                            <div>
                                <h3 className="font-headline-md text-headline-md text-on-surface">Order Out for Delivery</h3>
                                <p className="font-body-sm text-body-sm text-ink-secondary mt-1">Arriving in approx. 14 mins</p>
                            </div>
                            <div className="h-10 w-10 rounded-full bg-sage-signal/20 flex items-center justify-center text-sage-signal">
                                <span className="material-symbols-outlined">two_wheeler</span>
                            </div>
                        </div>
                        
                        <div className="relative z-10">
                            <div className="w-full bg-surface-elevated h-2 rounded-full overflow-hidden">
                                <div className="bg-sage-signal h-full w-[70%] rounded-full shadow-[0_0_8px_rgba(167,243,208,0.4)]"></div>
                            </div>
                            <div className="flex justify-between mt-2 font-clinical-data text-clinical-data text-ink-secondary text-[11px]">
                                <span>Kitchen</span>
                                <span className="text-on-surface">En route</span>
                                <span>Home</span>
                            </div>
                        </div>
                        
                        <div className="relative z-10 mt-6 pt-4 border-t border-hairline flex justify-between items-center">
                            <span className="font-clinical-data text-clinical-data text-on-surface-variant tracking-wider">#TM-9921-ZA</span>
                            <Link href="/account/orders" className="text-primary font-label-caps text-label-caps hover:opacity-80 flex items-center gap-1 group/link">
                                Track Order <span className="group-hover/link:translate-x-1 transition-transform">→</span>
                            </Link>
                        </div>
                    </div>
                </section>

                {/* Account Actions Grid */}
                <section>
                    <h2 className="font-label-caps text-label-caps text-ink-secondary mb-4 tracking-widest">MANAGEMENT</h2>
                    <div className="grid grid-cols-2 gap-4">
                        <Link href="/account/orders" className="flex flex-col items-center justify-center bg-surface border border-hairline rounded-2xl p-6 shadow-black/40 hover:border-primary/50 transition-colors active:scale-95 group">
                            <span className="material-symbols-outlined text-on-surface-variant group-hover:text-primary transition-colors text-3xl mb-3" style={{ fontVariationSettings: "'wght' 300" }}>receipt_long</span>
                            <span className="font-headline-md text-body-sm text-on-surface group-hover:text-primary transition-colors">Orders</span>
                        </Link>
                        
                        <Link href="/meal-planner" className="flex flex-col items-center justify-center bg-surface border border-hairline rounded-2xl p-6 shadow-black/40 hover:border-primary/50 transition-colors active:scale-95 group relative overflow-hidden">
                            <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-primary animate-pulse"></div>
                            <span className="material-symbols-outlined text-on-surface-variant group-hover:text-primary transition-colors text-3xl mb-3" style={{ fontVariationSettings: "'wght' 300" }}>calendar_month</span>
                            <span className="font-headline-md text-body-sm text-on-surface group-hover:text-primary transition-colors">Planner</span>
                        </Link>
                        
                        <Link href="/account/appointments" className="flex flex-col items-center justify-center bg-surface border border-hairline rounded-2xl p-6 shadow-black/40 hover:border-primary/50 transition-colors active:scale-95 group">
                            <span className="material-symbols-outlined text-on-surface-variant group-hover:text-primary transition-colors text-3xl mb-3" style={{ fontVariationSettings: "'wght' 300" }}>stethoscope</span>
                            <span className="font-headline-md text-body-sm text-on-surface group-hover:text-primary transition-colors text-center leading-tight">Clinical<br/>Consults</span>
                        </Link>

                        <Link href="/account/addresses" className="flex flex-col items-center justify-center bg-surface border border-hairline rounded-2xl p-6 shadow-black/40 hover:border-primary/50 transition-colors active:scale-95 group">
                            <span className="material-symbols-outlined text-on-surface-variant group-hover:text-primary transition-colors text-3xl mb-3" style={{ fontVariationSettings: "'wght' 300" }}>location_on</span>
                            <span className="font-headline-md text-body-sm text-on-surface group-hover:text-primary transition-colors">Addresses</span>
                        </Link>
                        
                        <Link href="/account/billing" className="flex flex-col items-center justify-center bg-surface border border-hairline rounded-2xl p-6 shadow-black/40 hover:border-primary/50 transition-colors active:scale-95 group">
                            <span className="material-symbols-outlined text-on-surface-variant group-hover:text-primary transition-colors text-3xl mb-3" style={{ fontVariationSettings: "'wght' 300" }}>credit_card</span>
                            <span className="font-headline-md text-body-sm text-on-surface group-hover:text-primary transition-colors">Billing</span>
                        </Link>
                        
                        <Link href="/account/wellness" className="flex flex-col items-center justify-center bg-surface border border-hairline rounded-2xl p-6 shadow-black/40 hover:border-primary/50 transition-colors active:scale-95 group">
                            <span className="material-symbols-outlined text-on-surface-variant group-hover:text-primary transition-colors text-3xl mb-3" style={{ fontVariationSettings: "'wght' 300" }}>health_and_safety</span>
                            <span className="font-headline-md text-body-sm text-on-surface group-hover:text-primary transition-colors">Wellness</span>
                        </Link>
                    </div>
                </section>

                {/* Settings & Support */}
                <section className="pt-4 border-t border-hairline space-y-2">
                    <Link href="/account/preferences" className="flex items-center justify-between p-4 rounded-xl hover:bg-surface transition-colors active:scale-[0.98]">
                        <div className="flex items-center gap-4">
                            <span className="material-symbols-outlined text-on-surface-variant" style={{ fontVariationSettings: "'wght' 300" }}>tune</span>
                            <span className="font-headline-md text-body-sm text-on-surface">Preferences & Diet</span>
                        </div>
                        <span className="material-symbols-outlined text-ink-secondary text-sm">chevron_right</span>
                    </Link>
                    
                    <Link href="/support" className="flex items-center justify-between p-4 rounded-xl hover:bg-surface transition-colors active:scale-[0.98]">
                        <div className="flex items-center gap-4">
                            <span className="material-symbols-outlined text-on-surface-variant" style={{ fontVariationSettings: "'wght' 300" }}>support_agent</span>
                            <span className="font-headline-md text-body-sm text-on-surface">Help & Support</span>
                        </div>
                        <span className="material-symbols-outlined text-ink-secondary text-sm">chevron_right</span>
                    </Link>
                </section>

                {/* Logout */}
                <section className="pt-8 pb-12 flex justify-center">
                    <button className="text-clay-danger font-label-caps text-label-caps hover:opacity-80 transition-opacity">
                        SIGN OUT
                    </button>
                </section>

            </main>

            {/* Bottom Nav Bar */}
            <nav className="fixed bottom-0 w-full z-50 h-[4rem] bg-surface dark:bg-surface border-t border-hairline shadow-black/40 pb-safe">
                <div className="flex justify-around items-center h-full px-4 max-w-md mx-auto">
                    <Link href="/meal-planner" className="flex flex-col items-center justify-center text-ink-secondary hover:text-primary transition-colors scale-[0.98] active:scale-95">
                        <span className="material-symbols-outlined mb-1">restaurant_menu</span>
                        <span className="font-label-caps text-label-caps">Plan</span>
                    </Link>
                    <Link href="/kitchen" className="flex flex-col items-center justify-center text-ink-secondary hover:text-primary transition-colors scale-[0.98] active:scale-95">
                        <span className="material-symbols-outlined mb-1">outdoor_grill</span>
                        <span className="font-label-caps text-label-caps">Kitchen</span>
                    </Link>
                    <Link href="/labs" className="flex flex-col items-center justify-center text-ink-secondary hover:text-primary transition-colors scale-[0.98] active:scale-95">
                        <span className="material-symbols-outlined mb-1">biotech</span>
                        <span className="font-label-caps text-label-caps">Labs</span>
                    </Link>
                    <Link href="/account" className="flex flex-col items-center justify-center text-primary font-bold scale-[0.98] active:scale-95">
                        <span className="material-symbols-outlined mb-1" style={{ fontVariationSettings: "'FILL' 1" }}>person</span>
                        <span className="font-label-caps text-label-caps">Profile</span>
                    </Link>
                </div>
            </nav>
        </div>
    );
}
