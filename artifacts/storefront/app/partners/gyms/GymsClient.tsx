"use client";

import React, { useState } from 'react';
import Link from 'next/link';

export default function GymsClient() {
    const [submitted, setSubmitted] = useState(false);
    const [facilityName, setFacilityName] = useState('');
    const [city, setCity] = useState('Bangalore');
    const [email, setEmail] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitted(true);
    };

    return (
        <div className="bg-[#FBFAF7] text-[#1A1C1E] min-h-screen pb-32">
            {/* Header */}
            <header className="w-full sticky top-0 bg-[#FBFAF7] z-40 border-b border-[#E7E3DA] px-4 h-16 flex items-center justify-between max-w-[1200px] mx-auto">
                <Link href="/" className="font-headline-md text-lg font-bold text-[#D4AF37] tracking-wider">
                    TANMATRA <span className="text-[#1A1C1E] text-xs font-normal ml-1 font-label-caps">PARTNERS</span>
                </Link>
                <a href="#partner-form" className="text-xs font-bold bg-[#D4AF37] text-[#1A1C1E] px-4 py-2 rounded-full hover:opacity-90 transition-opacity">
                    Partner With Us
                </a>
            </header>

            {/* Hero Section */}
            <section className="relative w-full min-h-[500px] flex items-center justify-center overflow-hidden border-b border-[#E7E3DA] px-4 py-16">
                <div className="max-w-[800px] mx-auto text-center space-y-6">
                    <span className="font-label-caps text-xs text-[#D4AF37] uppercase tracking-widest font-bold bg-white px-4 py-1.5 rounded-full border border-[#E7E3DA] shadow-sm inline-block">
                        GYM &amp; ATHLETIC FACILITY ECOSYSTEM
                    </span>
                    <h1 className="font-headline-md text-3xl md:text-5xl font-bold text-[#1A1C1E] leading-tight">
                        Fuel Your Members with Clinical-Grade Performance Nutrition.
                    </h1>
                    <p className="font-body-md text-sm md:text-base text-[#5C6367] max-w-2xl mx-auto leading-relaxed">
                        Bring Tanmatra&apos;s zero-seed-oil, macro-calibrated meals directly to your members. 
                        Dedicated on-site smart coolers, exclusive 20% member benefits, and revenue sharing.
                    </p>

                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
                        <a href="#partner-form" className="w-full sm:w-auto bg-[#D4AF37] text-[#1A1C1E] font-label-caps text-xs font-bold px-8 py-4 rounded-full hover:opacity-90 active:scale-[0.98] transition-all shadow-sm">
                            Apply for Facility Placement
                        </a>
                        <Link href="/performance" className="w-full sm:w-auto bg-white border border-[#E7E3DA] text-[#1A1C1E] font-label-caps text-xs font-bold px-8 py-4 rounded-full hover:bg-black/5 active:scale-[0.98] transition-all">
                            View Performance Protocol
                        </Link>
                    </div>
                </div>
            </section>

            <main className="max-w-[1200px] mx-auto px-4 mt-16 space-y-16">
                {/* Benefits Grid */}
                <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-white border border-[#E7E3DA] rounded-2xl p-6 shadow-sm space-y-3">
                        <div className="w-12 h-12 rounded-xl bg-[#FBFAF7] border border-[#E7E3DA] text-[#D4AF37] flex items-center justify-center">
                            <span className="material-symbols-outlined text-2xl">kitchen</span>
                        </div>
                        <h3 className="font-headline-md text-base font-bold text-[#1A1C1E]">Grab-and-Go Smart Coolers</h3>
                        <p className="font-body-sm text-xs text-[#5C6367] leading-relaxed">
                            Temperature-controlled on-site display coolers stocked daily with high-protein post-workout bowls and electrolyte broths.
                        </p>
                    </div>

                    <div className="bg-white border border-[#E7E3DA] rounded-2xl p-6 shadow-sm space-y-3">
                        <div className="w-12 h-12 rounded-xl bg-[#EBF2EB] text-[#4F6B50] flex items-center justify-center">
                            <span className="material-symbols-outlined text-2xl">percent</span>
                        </div>
                        <h3 className="font-headline-md text-base font-bold text-[#1A1C1E]">20% Exclusive Member Benefit</h3>
                        <p className="font-body-sm text-xs text-[#5C6367] leading-relaxed">
                            Every active member receives a dedicated partner token granting 20% off all ongoing meal subscriptions.
                        </p>
                    </div>

                    <div className="bg-white border border-[#E7E3DA] rounded-2xl p-6 shadow-sm space-y-3">
                        <div className="w-12 h-12 rounded-xl bg-[#FBFAF7] border border-[#E7E3DA] text-[#D4AF37] flex items-center justify-center">
                            <span className="material-symbols-outlined text-2xl">payments</span>
                        </div>
                        <h3 className="font-headline-md text-base font-bold text-[#1A1C1E]">Facility Revenue Share</h3>
                        <p className="font-body-sm text-xs text-[#5C6367] leading-relaxed">
                            Earn recurrent margin on all subscribed meals and on-site cooler sales originating from your facility.
                        </p>
                    </div>
                </section>

                {/* Partner Form */}
                <section id="partner-form" className="bg-white border border-[#E7E3DA] rounded-2xl p-8 shadow-sm max-w-2xl mx-auto space-y-6">
                    <div className="text-center space-y-2">
                        <span className="font-label-caps text-xs text-[#D4AF37] uppercase tracking-widest font-bold">JOIN THE NETWORK</span>
                        <h2 className="font-headline-md text-2xl font-bold text-[#1A1C1E]">Apply as a Gym Partner</h2>
                        <p className="font-body-sm text-xs text-[#5C6367]">
                            We deploy on-site infrastructure and member onboarding kits within 5 business days.
                        </p>
                    </div>

                    {submitted ? (
                        <div className="bg-[#EBF2EB] border border-[#7D9E7E]/30 rounded-2xl p-6 text-center space-y-2">
                            <span className="material-symbols-outlined text-3xl text-[#4F6B50]">check_circle</span>
                            <h3 className="font-headline-md text-base font-bold text-[#1A1C1E]">Application Received</h3>
                            <p className="font-body-sm text-xs text-[#4F6B50]">
                                Our partnerships lead will reach out to {email} to finalize cooler logistics.
                            </p>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="font-body-sm text-xs text-[#5C6367] block">Gym / Facility Name</label>
                                    <input 
                                        type="text"
                                        value={facilityName}
                                        onChange={(e) => setFacilityName(e.target.value)}
                                        placeholder="e.g. Iron Vault Fitness"
                                        required
                                        className="w-full px-3.5 py-2.5 rounded-xl border border-[#E7E3DA] text-sm bg-[#FBFAF7] focus:outline-none focus:border-[#D4AF37]"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="font-body-sm text-xs text-[#5C6367] block">Contact Email</label>
                                    <input 
                                        type="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        placeholder="manager@gym.com"
                                        required
                                        className="w-full px-3.5 py-2.5 rounded-xl border border-[#E7E3DA] text-sm bg-[#FBFAF7] focus:outline-none focus:border-[#D4AF37]"
                                    />
                                </div>
                            </div>

                            <div className="space-y-1">
                                <label className="font-body-sm text-xs text-[#5C6367] block">Primary Location</label>
                                <input 
                                    type="text"
                                    value={city}
                                    onChange={(e) => setCity(e.target.value)}
                                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#E7E3DA] text-sm bg-[#FBFAF7] focus:outline-none focus:border-[#D4AF37]"
                                />
                            </div>

                            <button 
                                type="submit"
                                className="w-full bg-[#D4AF37] text-[#1A1C1E] font-label-caps text-xs font-bold py-3.5 px-6 rounded-full hover:opacity-90 transition-opacity shadow-sm"
                            >
                                Submit Gym Partnership Request
                            </button>
                        </form>
                    )}
                </section>
            </main>
        </div>
    );
}
