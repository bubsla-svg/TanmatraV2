"use client";

import React, { useState } from 'react';
import Link from 'next/link';

export default function PremiumClient() {
    const [isMember, setIsMember] = useState(false);

    return (
        <div className="bg-[#FBFAF7] text-[#1A1C1E] min-h-screen flex flex-col items-center pb-32">
            {/* Top Navigation */}
            <header className="w-full sticky top-0 z-50 bg-[#FBFAF7] border-b border-[#E7E3DA]">
                <div className="flex items-center justify-between px-4 py-3 max-w-2xl mx-auto">
                    <Link href="/account" className="text-[#1A1C1E] hover:bg-[#eae1d4] transition-colors p-2 rounded-full flex items-center justify-center">
                        <span className="material-symbols-outlined">arrow_back</span>
                    </Link>
                    <h1 className="font-headline-md text-xl font-bold text-[#1A1C1E]">Membership</h1>
                    <div className="w-10"></div>
                </div>
            </header>

            <main className="w-full max-w-2xl px-4 py-8 flex-grow flex flex-col gap-8">
                {/* Header Section */}
                <section className="flex flex-col items-center text-center gap-2">
                    <span className="font-label-caps text-xs text-[#D4AF37] tracking-widest uppercase font-bold">TANMATRA PREMIUM</span>
                    <h2 className="font-display text-3xl md:text-4xl font-bold text-[#1A1C1E]">Eat better, recover faster, get expert guidance.</h2>
                    <p className="font-body-md text-sm md:text-base text-[#5C6367]">Clinical-grade nutrition for peak metabolic performance.</p>
                </section>

                {/* Prospective Member Card vs Active Member Card */}
                {!isMember ? (
                    <section className="bg-white border border-[#E7E3DA] rounded-3xl p-6 flex flex-col gap-4 shadow-sm">
                        <div className="flex items-baseline gap-2 justify-center">
                            <span className="font-data-lg text-4xl font-bold text-[#1A1C1E] leading-none tabular-nums">₹499</span>
                            <span className="font-body-md text-sm text-[#5C6367]">/ month</span>
                        </div>
                        <button 
                            onClick={() => setIsMember(true)}
                            className="w-full bg-[#D4AF37] text-[#1A1C1E] font-headline-sm text-base md:text-lg font-bold py-4 rounded-2xl hover:opacity-90 transition-opacity active:scale-[0.98]"
                        >
                            Join Tanmatra Premium
                        </button>
                        <p className="font-body-md text-xs text-center text-[#6B7378]">
                            Cancel anytime · your first RD consult is included every period.
                        </p>
                    </section>
                ) : (
                    <section className="flex flex-col gap-2">
                        <span className="font-label-caps text-xs text-[#5C6367] tracking-widest uppercase font-bold">Your Membership</span>
                        <div className="bg-white border border-[#E7E3DA] rounded-3xl p-6 flex flex-col gap-4 shadow-sm">
                            <div className="flex justify-between items-center">
                                <div className="flex items-baseline gap-2">
                                    <span className="font-data-lg text-2xl font-bold text-[#1A1C1E] leading-none tabular-nums">₹499</span>
                                    <span className="font-body-md text-xs text-[#5C6367]">/ month</span>
                                </div>
                                <div className="bg-[rgba(125,158,126,0.12)] text-[#4F6B50] px-3 py-1 rounded-full font-body-md text-xs font-medium">
                                    Active membership — renews on 12 Sep
                                </div>
                            </div>
                            <div className="flex justify-between items-center py-3 border-t border-b border-[#E7E3DA]">
                                <span className="font-body-md text-sm text-[#1A1C1E]">RD consults used this period:</span>
                                <span className="font-data-lg text-sm text-[#1A1C1E] font-bold">1 / 1</span>
                            </div>
                            <Link 
                                href="/account/appointments"
                                className="w-full bg-[#D4AF37] text-[#1A1C1E] font-headline-sm text-base font-bold py-4 rounded-2xl text-center hover:opacity-90 transition-opacity active:scale-[0.98]"
                            >
                                Book your free RD consult
                            </Link>
                            <div className="text-center mt-1">
                                <button 
                                    onClick={() => setIsMember(false)}
                                    className="font-body-md text-xs text-[#6B7378] underline hover:text-[#1A1C1E] transition-colors"
                                >
                                    Cancel renewal
                                </button>
                            </div>
                        </div>
                    </section>
                )}

                {/* Benefit Grid */}
                <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Benefit 1 */}
                    <div className="bg-white border border-[#E7E3DA] rounded-2xl p-5 flex flex-col gap-1 hover:border-[#cbc4d2] transition-colors">
                        <div className="flex items-center gap-3 mb-2">
                            <span className="material-symbols-outlined text-[#D4AF37]">sync</span>
                            <h3 className="font-headline-sm text-base font-bold text-[#1A1C1E]">Metabolic Lab Sync</h3>
                        </div>
                        <p className="font-body-md text-xs text-[#5C6367] leading-relaxed">Automatically integrate your lab results for holistic analysis.</p>
                    </div>
                    {/* Benefit 2 */}
                    <div className="bg-white border border-[#E7E3DA] rounded-2xl p-5 flex flex-col gap-1 hover:border-[#cbc4d2] transition-colors">
                        <div className="flex items-center gap-3 mb-2">
                            <span className="material-symbols-outlined text-[#D4AF37]">restaurant_menu</span>
                            <h3 className="font-headline-sm text-base font-bold text-[#1A1C1E]">Meal Personalization</h3>
                        </div>
                        <p className="font-body-md text-xs text-[#5C6367] leading-relaxed">Custom nutrition plans based on your unique metabolic profile.</p>
                    </div>
                    {/* Benefit 3 */}
                    <div className="bg-white border border-[#E7E3DA] rounded-2xl p-5 flex flex-col gap-1 hover:border-[#cbc4d2] transition-colors">
                        <div className="flex items-center gap-3 mb-2">
                            <span className="material-symbols-outlined text-[#D4AF37]">support_agent</span>
                            <h3 className="font-headline-sm text-base font-bold text-[#1A1C1E]">Priority RD Access</h3>
                        </div>
                        <p className="font-body-md text-xs text-[#5C6367] leading-relaxed">Direct messaging with registered dietitians for quick guidance.</p>
                    </div>
                    {/* Benefit 4 */}
                    <div className="bg-white border border-[#E7E3DA] rounded-2xl p-5 flex flex-col gap-1 hover:border-[#cbc4d2] transition-colors">
                        <div className="flex items-center gap-3 mb-2">
                            <span className="material-symbols-outlined text-[#D4AF37]">monitoring</span>
                            <h3 className="font-headline-sm text-base font-bold text-[#1A1C1E]">Advanced Analytics</h3>
                        </div>
                        <p className="font-body-md text-xs text-[#5C6367] leading-relaxed">Deeper insights into your recovery and performance trends.</p>
                    </div>
                </section>
            </main>

            {/* Footer Disclaimer */}
            <footer className="w-full max-w-2xl px-4 text-center">
                <p className="font-body-md text-xs text-[#6B7378] opacity-80 leading-relaxed">
                    Tanmatra Premium is a subscription service. Your subscription automatically renews unless auto-renew is turned off at least 24-hours before the end of the current period. Consultations are subject to availability.
                </p>
            </footer>
        </div>
    );
}
