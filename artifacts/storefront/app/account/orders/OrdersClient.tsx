"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import MealFeedback from '@/components/feedback/MealFeedback';

export default function OrdersClient() {
    const [scrolled, setScrolled] = useState(false);
    const [feedbackMeal, setFeedbackMeal] = useState<{ id: string; name: string } | null>(null);

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
                    <div className="flex items-center gap-4">
                        <Link href="/account" className="h-10 w-10 rounded-full border border-hairline flex items-center justify-center bg-surface hover:bg-surface-elevated transition-colors text-on-surface">
                            <span className="material-symbols-outlined" style={{ fontVariationSettings: "'wght' 300" }}>arrow_back</span>
                        </Link>
                        <div>
                            <h1 className="font-display text-display text-on-surface tracking-tight mt-1">Profile</h1>
                        </div>
                    </div>
                    <button className="h-10 w-10 rounded-full border border-hairline flex items-center justify-center bg-surface hover:bg-surface-elevated transition-colors text-on-surface">
                        <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 0, 'wght' 300" }}>notifications</span>
                    </button>
                </div>
            </header>

            <main className="px-gutter pt-6 max-w-md mx-auto">
                <section className="mb-6">
                    <h2 className="font-headline-md text-headline-md text-on-surface">Activity</h2>
                    <p className="text-ink-secondary font-body-sm text-body-sm">Your clinical history and metabolic logs.</p>
                </section>

                {/* Underline Tab Bar (Horizontally Scrollable) */}
                <nav className="sticky top-16 z-40 bg-canvas/80 backdrop-blur-sm -mx-gutter mb-8 border-b border-hairline overflow-x-auto no-scrollbar">
                    <div className="flex px-gutter space-x-6">
                        <Link href="/account/subscriptions" className="py-3 font-label-caps text-label-caps whitespace-nowrap text-ink-secondary hover:text-primary transition-colors">Plans</Link>
                        <Link href="/account/orders" className="py-3 font-label-caps text-label-caps whitespace-nowrap active-tab font-bold text-on-surface">Orders</Link>
                        <Link href="/account/appointments" className="py-3 font-label-caps text-label-caps whitespace-nowrap text-ink-secondary hover:text-primary transition-colors">Consults</Link>
                        <Link href="/account/billing" className="py-3 font-label-caps text-label-caps whitespace-nowrap text-ink-secondary hover:text-primary transition-colors">Billing</Link>
                        <Link href="/account/addresses" className="py-3 font-label-caps text-label-caps whitespace-nowrap text-ink-secondary hover:text-primary transition-colors">Addresses</Link>
                        <Link href="/account/preferences" className="py-3 font-label-caps text-label-caps whitespace-nowrap text-ink-secondary hover:text-primary transition-colors">Preferences</Link>
                        <Link href="/account/wellness" className="py-3 font-label-caps text-label-caps whitespace-nowrap text-ink-secondary hover:text-primary transition-colors">Health</Link>
                        <Link href="/account/favorites" className="py-3 font-label-caps text-label-caps whitespace-nowrap text-ink-secondary hover:text-primary transition-colors">Rewards</Link>
                    </div>
                </nav>

                {/* Order Cards List */}
                <div className="space-y-4">
                    {/* Order 1: Out for Delivery */}
                    <div className="rounded-xl border border-hairline bg-surface p-4 shadow-black/40 transition-all duration-200 active:scale-[0.98]">
                        <div className="flex justify-between items-start mb-2">
                            <span className="font-headline-md text-body-sm font-semibold text-sage-signal flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-sage-signal animate-pulse"></span>
                                Out for delivery
                            </span>
                            <span className="font-clinical-data text-clinical-data text-on-surface font-semibold">₹1,450</span>
                        </div>
                        <div className="font-clinical-data text-clinical-data text-ink-secondary mb-4">
                            #TM-9921-ZA · Today · <span className="text-on-surface-variant">Home</span>
                        </div>
                        <div className="flex gap-4">
                            <Link href="#" className="text-primary font-label-caps text-label-caps hover:opacity-80 flex items-center gap-1 group">
                                Track <span className="group-hover:translate-x-1 transition-transform">→</span>
                            </Link>
                            <button className="text-primary font-label-caps text-label-caps hover:opacity-80">Reorder</button>
                        </div>
                    </div>

                    {/* Order 2: Delivered */}
                    <div className="rounded-xl border border-hairline bg-surface p-4 shadow-black/40 transition-all duration-200 active:scale-[0.98]">
                        <div className="flex justify-between items-start mb-2">
                            <span className="font-headline-md text-body-sm font-semibold text-on-surface-variant">Delivered</span>
                            <span className="font-clinical-data text-clinical-data text-on-surface font-semibold">₹4,900</span>
                        </div>
                        <div className="font-clinical-data text-clinical-data text-ink-secondary mb-4">
                            #TM-8829-QX · 21 Oct 2024
                        </div>
                        <div className="flex gap-4">
                            <button className="text-primary font-label-caps text-label-caps hover:opacity-80">Reorder</button>
                            <button 
                                onClick={() => setFeedbackMeal({ id: 'dish-keto-bowl', name: 'The Nordic Fuel Bowl' })}
                                className="text-on-surface-variant hover:text-primary font-label-caps text-label-caps flex items-center gap-1"
                            >
                                <span className="material-symbols-outlined text-xs">rate_review</span> Rate meal
                            </button>
                        </div>
                    </div>

                    {/* Visual Break/Hero Imagery for appetite appeal */}
                    <div className="relative h-48 rounded-xl overflow-hidden group">
                        <div className="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-110" style={{ backgroundImage: "url('https://lh3.googleusercontent.com/aida-public/AB6AXuBgbUm_L2WFDyhnCmlcbpGw7Ig1OqdByWDziGHpRh29IkYTq3aSduO6NjoQu4dYGXdS4B3QHPBCK8pOazcUzLUOkKMXarrwgcIDgqLfEmp3L1AoA7UPXKCd5otGDxyFHXaciowgQfKRSM6zFC-tmT6eZLPgVM1PatmjyoFQD8HR1CofKwmMk_aF60BsF84SKvQHmoBDtgVAl4zz1ZrvDFB-PcoY2eareAVjGWKLjOcKd_kt4K1HBSN2bn_jETxJreVL6P9PgRo1XT8')" }} data-alt="A top-down professional food photography shot of a vibrant, gourmet metabolic health bowl featuring wild salmon, avocado, deep green kale, and roasted turmeric cauliflower. The lighting is cinematic with soft directional shadows, creating a high-end restaurant aesthetic. The colors are rich and natural against a dark, textured slate surface. Minimalist and appetizing."></div>
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent"></div>
                        <div className="absolute bottom-4 left-4">
                            <p className="font-label-caps text-label-caps text-primary mb-1">METABOLIC FAVORITE</p>
                            <p className="font-headline-md text-headline-md text-white font-bold">The Nordic Fuel Bowl</p>
                        </div>
                    </div>

                    {/* Order 3: Delivered */}
                    <div className="rounded-xl border border-hairline bg-surface p-4 shadow-black/40 transition-all duration-200 active:scale-[0.98]">
                        <div className="flex justify-between items-start mb-2">
                            <span className="font-headline-md text-body-sm font-semibold text-on-surface-variant">Delivered</span>
                            <span className="font-clinical-data text-clinical-data text-on-surface font-semibold">₹2,650</span>
                        </div>
                        <div className="font-clinical-data text-clinical-data text-ink-secondary mb-4">
                            #TM-7712-BT · 14 Oct 2024 · <span className="text-on-surface-variant">Office</span>
                        </div>
                        <div className="flex gap-4">
                            <button className="text-primary font-label-caps text-label-caps hover:opacity-80">Reorder</button>
                            <button 
                                onClick={() => setFeedbackMeal({ id: 'dish-chicken-quinoa', name: 'Turmeric Chicken Quinoa' })}
                                className="text-on-surface-variant hover:text-primary font-label-caps text-label-caps flex items-center gap-1"
                            >
                                <span className="material-symbols-outlined text-xs">rate_review</span> Rate meal
                            </button>
                        </div>
                    </div>

                    {/* Order 4: Payment Failed */}
                    <div className="rounded-xl border border-hairline bg-surface p-4 shadow-black/40 transition-all duration-200 active:scale-[0.98] opacity-60">
                        <div className="flex justify-between items-start mb-2">
                            <span className="font-headline-md text-body-sm font-semibold text-clay-danger">Payment failed</span>
                            <span className="font-clinical-data text-clinical-data text-on-surface font-semibold">₹1,200</span>
                        </div>
                        <div className="font-clinical-data text-clinical-data text-ink-secondary">
                            #TM-6601-PL · 07 Oct 2024
                        </div>
                        <div className="mt-4">
                            <p className="text-[10px] text-ink-secondary uppercase tracking-widest font-bold">Incomplete Transaction</p>
                        </div>
                    </div>

                    {/* Bottom Spacer for Safe Area */}
                    <div className="h-16"></div>
                </div>
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

            {feedbackMeal && (
                <MealFeedback
                    mealId={feedbackMeal.id}
                    mealName={feedbackMeal.name}
                    isOpen={!!feedbackMeal}
                    onClose={() => setFeedbackMeal(null)}
                />
            )}
        </div>
    );
}
