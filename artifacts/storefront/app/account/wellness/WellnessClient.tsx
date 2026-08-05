"use client";

import React, { useState } from 'react';
import Link from 'next/link';

export default function WellnessClient() {
    return (
        <div className="min-h-screen bg-canvas text-ink-primary font-body-sm selection:bg-primary selection:text-ink-on-gold">
            {/* Global Navigation Anchor */}
            <header className="fixed top-0 w-full z-50 backdrop-blur-md bg-glass border-b border-hairline flex justify-between items-center px-gutter h-16">
                <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-primary" style={{ fontVariationSettings: "'FILL' 0, 'wght' 400" }}>menu</span>
                    <span className="font-headline-md text-headline-md tracking-widest text-primary">METABOLIC OS</span>
                </div>
                <div className="w-8 h-8 rounded-full bg-surface-container border border-hairline overflow-hidden">
                    <img 
                        className="w-full h-full object-cover" 
                        src="https://lh3.googleusercontent.com/aida-public/AB6AXuBlTT_hGIsTZENtAI8CkjHkCMonPM6QSUd05VcEVsCZKdgE9Y9t5wjMErzbpV6ZMwr5XKO1JwEPqdSTEgA-qBHQ7KO_1-LET8uJthqFCvwIR5K_lt4p7Kuq7ZPwe4aQOrb80ntSFJLYgXMncSbq3RnW36f1PKGWVFhpIjFnTmv3o3HoLtaVMZv6Gz046zUE9-Mh2NECKCqfJ7ZLfaHXyf9KX3q-Hn8th2wU12avnyedHoTlG5ON0ehaY02FWmHxevz1LwGuHqkoKsY"
                        alt="Profile"
                    />
                </div>
            </header>

            <main className="pt-24 pb-32 px-gutter max-w-screen-xl mx-auto space-y-12">
                {/* Header Section */}
                <section className="space-y-1">
                    <p className="font-label-caps text-label-caps text-ink-secondary uppercase tracking-widest">TODAY</p>
                    <h1 className="font-headline-lg-mobile text-headline-lg-mobile md:font-headline-lg md:text-headline-lg">Nutrition tracker</h1>
                </section>

                {/* Core Metrics Section: Progress Rings Grid */}
                <section className="grid grid-cols-2 gap-4">
                    {/* Calories */}
                    <div className="bg-surface p-6 border border-hairline rounded-3xl flex flex-col items-center justify-center space-y-4 shadow-black/40">
                        <div className="relative w-24 h-24">
                            <svg className="w-full h-full">
                                <circle className="text-hairline" cx="48" cy="48" fill="transparent" r="40" stroke="currentColor" strokeWidth="6"></circle>
                                <circle className="text-primary transition-all duration-700 ease-out -rotate-90 origin-center" cx="48" cy="48" fill="transparent" r="40" stroke="currentColor" strokeDasharray="251.2" strokeDashoffset="62.8" strokeLinecap="round" strokeWidth="6"></circle>
                            </svg>
                            <div className="absolute inset-0 flex items-center justify-center">
                                <span className="font-clinical-data text-xl text-primary">75%</span>
                            </div>
                        </div>
                        <div className="text-center">
                            <p className="font-label-caps text-ink-secondary mb-1">CALORIES</p>
                            <p className="font-clinical-data text-clinical-data">1,450 / 2,200 kcal</p>
                        </div>
                    </div>

                    {/* Protein */}
                    <div className="bg-surface p-6 border border-hairline rounded-3xl flex flex-col items-center justify-center space-y-4 shadow-black/40">
                        <div className="relative w-24 h-24">
                            <svg className="w-full h-full">
                                <circle className="text-hairline" cx="48" cy="48" fill="transparent" r="40" stroke="currentColor" strokeWidth="6"></circle>
                                <circle className="text-primary transition-all duration-700 ease-out -rotate-90 origin-center" cx="48" cy="48" fill="transparent" r="40" stroke="currentColor" strokeDasharray="251.2" strokeDashoffset="150" strokeLinecap="round" strokeWidth="6"></circle>
                            </svg>
                            <div className="absolute inset-0 flex items-center justify-center">
                                <span className="font-clinical-data text-xl text-primary">40%</span>
                            </div>
                        </div>
                        <div className="text-center">
                            <p className="font-label-caps text-ink-secondary mb-1">PROTEIN</p>
                            <p className="font-clinical-data text-clinical-data">64 / 160 g</p>
                        </div>
                    </div>

                    {/* Fibre */}
                    <div className="bg-surface p-6 border border-hairline rounded-3xl flex flex-col items-center justify-center space-y-4 shadow-black/40">
                        <div className="relative w-24 h-24">
                            <svg className="w-full h-full">
                                <circle className="text-hairline" cx="48" cy="48" fill="transparent" r="40" stroke="currentColor" strokeWidth="6"></circle>
                                <circle className="text-primary transition-all duration-700 ease-out -rotate-90 origin-center" cx="48" cy="48" fill="transparent" r="40" stroke="currentColor" strokeDasharray="251.2" strokeDashoffset="25" strokeLinecap="round" strokeWidth="6"></circle>
                            </svg>
                            <div className="absolute inset-0 flex items-center justify-center">
                                <span className="font-clinical-data text-xl text-primary">90%</span>
                            </div>
                        </div>
                        <div className="text-center">
                            <p className="font-label-caps text-ink-secondary mb-1">FIBRE</p>
                            <p className="font-clinical-data text-clinical-data">27 / 30 g</p>
                        </div>
                    </div>

                    {/* Water */}
                    <div className="bg-surface p-6 border border-hairline rounded-3xl flex flex-col items-center justify-center space-y-4 shadow-black/40">
                        <div className="relative w-24 h-24">
                            <svg className="w-full h-full">
                                <circle className="text-hairline" cx="48" cy="48" fill="transparent" r="40" stroke="currentColor" strokeWidth="6"></circle>
                                <circle className="text-primary transition-all duration-700 ease-out -rotate-90 origin-center" cx="48" cy="48" fill="transparent" r="40" stroke="currentColor" strokeDasharray="251.2" strokeDashoffset="125" strokeLinecap="round" strokeWidth="6"></circle>
                            </svg>
                            <div className="absolute inset-0 flex items-center justify-center">
                                <span className="font-clinical-data text-xl text-primary">50%</span>
                            </div>
                        </div>
                        <div className="text-center">
                            <p className="font-label-caps text-ink-secondary mb-1">WATER</p>
                            <p className="font-clinical-data text-clinical-data">1,250 / 2,500 ml</p>
                        </div>
                    </div>
                </section>

                {/* Actions: Quick Add & Log Button */}
                <section className="flex items-center justify-between gap-4 overflow-x-auto hide-scrollbar">
                    <div className="flex gap-2 shrink-0">
                        <button className="px-4 py-2 rounded-full border border-hairline hover:bg-surface transition-colors font-clinical-data text-xs active:scale-95">+200 ml</button>
                        <button className="px-4 py-2 rounded-full border border-hairline hover:bg-surface transition-colors font-clinical-data text-xs active:scale-95">+250 ml</button>
                        <button className="px-4 py-2 rounded-full border border-hairline hover:bg-surface transition-colors font-clinical-data text-xs active:scale-95">+500 ml</button>
                    </div>
                    <button className="bg-primary hover:bg-primary-container text-ink-on-gold px-6 py-3 rounded-full flex items-center gap-2 transition-all active:scale-[0.98] font-headline-md text-sm shrink-0 shadow-lg shadow-primary/20">
                        <span className="material-symbols-outlined" style={{ fontVariationSettings: "'wght' 400" }}>add</span>
                        Log meal
                    </button>
                </section>

                {/* Connected Devices & Wearable Telemetry Placement */}
                <section className="bg-surface border border-hairline p-6 rounded-3xl space-y-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                                <span className="material-symbols-outlined">health_and_safety</span>
                            </div>
                            <div>
                                <h3 className="font-headline-md text-base font-bold text-ink-primary">Connected Health Devices</h3>
                                <p className="font-body-sm text-xs text-ink-secondary">Apple Health sync active · 9,420 steps today</p>
                            </div>
                        </div>
                        <Link 
                            href="/account/connections"
                            className="text-xs font-label-caps text-primary border border-hairline px-3 py-1.5 rounded-full hover:bg-surface-container transition-colors"
                        >
                            Manage
                        </Link>
                    </div>
                    <div className="p-3 bg-canvas border border-hairline rounded-2xl flex items-center justify-between text-xs text-ink-secondary">
                        <span className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-sage-signal animate-pulse"></span>
                            Telemetry-informed recommendation active
                        </span>
                        <span className="text-[11px] font-clinical-data text-primary">480 kcal burn</span>
                    </div>
                </section>

                {/* Signals Section */}
                <section className="space-y-3">
                    <div className="bg-sage-signal/10 border border-sage-signal/20 px-4 py-2 rounded-full inline-flex items-center gap-2">
                        <span className="material-symbols-outlined text-sage-signal text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>stars</span>
                        <p className="text-sage-signal font-clinical-data text-xs">Protein streak 3d · best 7d</p>
                    </div>
                    <div className="bg-sage-signal/10 border border-sage-signal/20 px-4 py-2 rounded-full inline-flex items-center gap-2 ml-2">
                        <span className="material-symbols-outlined text-sage-signal text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>water_drop</span>
                        <p className="text-sage-signal font-clinical-data text-xs">Hydration streak 12d</p>
                    </div>
                </section>

                {/* Today's Log List */}
                <section className="space-y-6">
                    <h2 className="font-headline-md text-headline-md">Today's entries</h2>
                    <div className="space-y-3">
                        {/* Entry 1 */}
                        <div className="bg-surface-container-low border border-hairline p-4 rounded-2xl flex items-center justify-between group">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-xl overflow-hidden bg-surface-container-highest">
                                    <img className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" src="https://lh3.googleusercontent.com/aida-public/AB6AXuDai-Ji9yHeOSUajSZNb9PmqxR2ovNJB2SVotWf_OJ1Rz4DgCaNjgmxPBLbUB5SUkgJfDNaGLD2CricrMeTlqfVBeqkoH8qn5Ttx8OfgmHpgQj876x15YTz7pbVpCvDBqXr2yU9kJ17VcnSkhOd576AH5CgGyuq4BG6nyHdGx1Gv0VWNLTkthGJK9M6NXsIN_wDZJD16JX8Gj4yOkzEkVJH21iNRozRIg64pJoCxbG6MU6sRrFVenpEfyZ1PkkMV-PTb3RKdUI0bYQ" alt="Keto-Cleanse Bowl" />
                                </div>
                                <div>
                                    <h3 className="font-body-lg text-ink-primary">Keto-Cleanse Bowl</h3>
                                    <p className="font-clinical-data text-xs text-ink-secondary">Lunch · 450 kcal · 32P · 8C · 22F</p>
                                </div>
                            </div>
                            <button className="opacity-0 group-hover:opacity-100 transition-opacity p-2 text-ink-secondary hover:text-clay-danger active:scale-95">
                                <span className="material-symbols-outlined text-xl" style={{ fontVariationSettings: "'wght' 400" }}>delete</span>
                            </button>
                        </div>
                        {/* Entry 2 */}
                        <div className="bg-surface-container-low border border-hairline p-4 rounded-2xl flex items-center justify-between group">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-xl overflow-hidden bg-surface-container-highest">
                                    <img className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" src="https://lh3.googleusercontent.com/aida-public/AB6AXuALDg2HIlfpaKSmXzbhfP7mF15DwLmcc96xezpKqY01fzNIsoHgjlBC0PTyNNH9vndGilpwmqyrm7_Ge1xJp88vroAPlV_OMWQZeMPtgP3jiOnWcFVXbfoRaXTCzMukfLD2AgSl3TPuPwvbz8cfJPyJQw894bMeE4z2GAK0QTc__QefV-kwNBzzeHfqWt2X0LBPQxM2kiiztCJKcBcnxxgdRNZlojJthSDJ_AvJScr0-UvrqRqpWXM6h3Lg9VkeMTMg39IQ6-_rsr4" alt="Electrolyte Infusion" />
                                </div>
                                <div>
                                    <h3 className="font-body-lg text-ink-primary">Electrolyte Infusion</h3>
                                    <p className="font-clinical-data text-xs text-ink-secondary">Drink · 0 kcal · 0P · 0C · 0F</p>
                                </div>
                            </div>
                            <button className="opacity-0 group-hover:opacity-100 transition-opacity p-2 text-ink-secondary hover:text-clay-danger active:scale-95">
                                <span className="material-symbols-outlined text-xl" style={{ fontVariationSettings: "'wght' 400" }}>delete</span>
                            </button>
                        </div>
                        {/* Entry 3 */}
                        <div className="bg-surface-container-low border border-hairline p-4 rounded-2xl flex items-center justify-between group">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-xl overflow-hidden bg-surface-container-highest">
                                    <img className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" src="https://lh3.googleusercontent.com/aida-public/AB6AXuCHxyhhQov9y_H09xBjmuei36AxbJkM7LaLSaFdSIFaVjNfIgiuAYBbTwj6gBMum6bjFaKbO1DCpB9wK1XSMKODVzvtbVmQjglGwozzJYITiOih1tUPiaj6TDEo3tu_dk9b7p-13L364c56Y4vpcIxzT2a-j7BQZs5duMJRW4LMRa92OMGi76-i2D3v26rdJgZvrvLPSqFvMOwkQNyNisiWuntwLvnVfIM759utNPdrimScIEaCG38M9n1mSvWuI11iQFq5B3f-a34" alt="Prime Rib & Greens" />
                                </div>
                                <div>
                                    <h3 className="font-body-lg text-ink-primary">Prime Rib & Greens</h3>
                                    <p className="font-clinical-data text-xs text-ink-secondary">Dinner · 820 kcal · 58P · 4C · 42F</p>
                                </div>
                            </div>
                            <button className="opacity-0 group-hover:opacity-100 transition-opacity p-2 text-ink-secondary hover:text-clay-danger active:scale-95">
                                <span className="material-symbols-outlined text-xl" style={{ fontVariationSettings: "'wght' 400" }}>delete</span>
                            </button>
                        </div>
                    </div>
                </section>

                {/* Weekly Performance Section */}
                <section className="space-y-6">
                    <h2 className="font-headline-md text-headline-md">Weekly performance</h2>
                    <div className="grid grid-cols-2 gap-4">
                        {/* Calories Card */}
                        <div className="bg-surface border border-hairline p-5 rounded-3xl space-y-4">
                            <p className="font-label-caps text-ink-secondary">CALORIES</p>
                            <div className="flex items-end justify-between h-20 gap-1 px-1">
                                {[{ day: 'M', h: '60%' }, { day: 'T', h: '85%' }, { day: 'W', h: '70%' }, { day: 'T', h: '40%' }, { day: 'F', h: '95%' }].map((col, i) => (
                                    <div key={i} className="flex flex-col items-center gap-2 flex-1">
                                        <div className="w-full bg-hairline rounded-full h-12 relative overflow-hidden">
                                            <div className="absolute bottom-0 w-full bg-primary rounded-full" style={{ height: col.h }}></div>
                                        </div>
                                        <span className="font-clinical-data text-[10px] text-ink-secondary">{col.day}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                        {/* Protein Card */}
                        <div className="bg-surface border border-hairline p-5 rounded-3xl space-y-4">
                            <p className="font-label-caps text-ink-secondary">PROTEIN</p>
                            <div className="flex items-end justify-between h-20 gap-1 px-1">
                                {[{ day: 'M', h: '80%' }, { day: 'T', h: '60%' }, { day: 'W', h: '50%' }, { day: 'T', h: '40%' }, { day: 'F', h: '90%' }].map((col, i) => (
                                    <div key={i} className="flex flex-col items-center gap-2 flex-1">
                                        <div className="w-full bg-hairline rounded-full h-12 relative overflow-hidden">
                                            <div className="absolute bottom-0 w-full bg-primary rounded-full" style={{ height: col.h }}></div>
                                        </div>
                                        <span className="font-clinical-data text-[10px] text-ink-secondary">{col.day}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                        {/* Water Card */}
                        <div className="bg-surface border border-hairline p-5 rounded-3xl space-y-4">
                            <p className="font-label-caps text-ink-secondary">WATER</p>
                            <div className="flex items-end justify-between h-20 gap-1 px-1">
                                {[{ day: 'M', h: '90%' }, { day: 'T', h: '70%' }, { day: 'W', h: '100%' }, { day: 'T', h: '80%' }, { day: 'F', h: '60%' }].map((col, i) => (
                                    <div key={i} className="flex flex-col items-center gap-2 flex-1">
                                        <div className="w-full bg-hairline rounded-full h-12 relative overflow-hidden">
                                            <div className="absolute bottom-0 w-full bg-primary rounded-full" style={{ height: col.h }}></div>
                                        </div>
                                        <span className="font-clinical-data text-[10px] text-ink-secondary">{col.day}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                        {/* Fiber Card */}
                        <div className="bg-surface border border-hairline p-5 rounded-3xl space-y-4">
                            <p className="font-label-caps text-ink-secondary">FIBRE</p>
                            <div className="flex items-end justify-between h-20 gap-1 px-1">
                                {[{ day: 'M', h: '50%' }, { day: 'T', h: '40%' }, { day: 'W', h: '60%' }, { day: 'T', h: '70%' }, { day: 'F', h: '80%' }].map((col, i) => (
                                    <div key={i} className="flex flex-col items-center gap-2 flex-1">
                                        <div className="w-full bg-hairline rounded-full h-12 relative overflow-hidden">
                                            <div className="absolute bottom-0 w-full bg-primary rounded-full" style={{ height: col.h }}></div>
                                        </div>
                                        <span className="font-clinical-data text-[10px] text-ink-secondary">{col.day}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </section>

                {/* Legal Disclaimer Footer */}
                <footer className="pt-8 opacity-40">
                    <p className="text-[11px] leading-relaxed text-center">
                        Metabolic OS is for informational purposes and does not constitute medical advice. Consult a healthcare professional before making significant dietary changes. © 2024 Metabolic Systems Inc.
                    </p>
                </footer>
            </main>

            {/* Bottom Nav */}
            <nav className="fixed bottom-0 w-full z-50 backdrop-blur-md bg-glass border-t border-hairline pb-safe">
                <div className="flex justify-around items-center h-16 w-full px-4">
                    <Link href="/account" className="flex flex-col items-center justify-center text-ink-secondary transition-all active:scale-[0.98]">
                        <span className="material-symbols-outlined" style={{ fontVariationSettings: "'wght' 400" }}>analytics</span>
                        <span className="font-label-caps text-[10px] mt-1">Dashboard</span>
                    </Link>
                    <Link href="/meal-planner" className="flex flex-col items-center justify-center text-ink-secondary transition-all active:scale-[0.98]">
                        <span className="material-symbols-outlined" style={{ fontVariationSettings: "'wght' 400" }}>restaurant_menu</span>
                        <span className="font-label-caps text-[10px] mt-1">Menu</span>
                    </Link>
                    <Link href="/account/subscriptions" className="flex flex-col items-center justify-center text-ink-secondary transition-all active:scale-[0.98]">
                        <span className="material-symbols-outlined" style={{ fontVariationSettings: "'wght' 400" }}>assignment_turned_in</span>
                        <span className="font-label-caps text-[10px] mt-1">Plans</span>
                    </Link>
                    <Link href="/account" className="flex flex-col items-center justify-center text-primary bg-primary-container/10 rounded-xl px-3 py-1 transition-all active:scale-[0.98]">
                        <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1, 'wght' 400" }}>person</span>
                        <span className="font-label-caps text-[10px] mt-1">Profile</span>
                    </Link>
                </div>
            </nav>
        </div>
    );
}
