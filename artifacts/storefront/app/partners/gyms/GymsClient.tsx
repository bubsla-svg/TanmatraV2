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
        <div className="bg-gray-50 text-gray-900 min-h-screen pb-32">
            {/* Header */}
            <header className="w-full sticky top-0 bg-gray-50 z-40 border-b border-gray-200 px-4 h-16 flex items-center justify-between max-w-[1200px] mx-auto">
                <Link href="/" className="font-headline-md text-lg font-bold text-yellow-500 tracking-wider">
                    TANMATRA <span className="text-gray-900 text-xs font-normal ml-1 font-label-caps">PARTNERS</span>
                </Link>
                <a href="#partner-form" className="text-xs font-bold bg-yellow-500 text-gray-900 px-4 py-2 rounded-full hover:opacity-90 transition-opacity">
                    Partner With Us
                </a>
            </header>

            {/* Hero Section */}
            <section className="relative w-full min-h-[500px] flex items-center justify-center overflow-hidden border-b border-gray-200 px-4 py-16">
                <div className="max-w-[800px] mx-auto text-center space-y-6">
                    <span className="font-label-caps text-xs text-yellow-500 uppercase tracking-widest font-bold bg-white px-4 py-1.5 rounded-full border border-gray-200 shadow-sm inline-block">
                        GYM &amp; ATHLETIC FACILITY ECOSYSTEM
                    </span>
                    <h1 className="font-headline-md text-3xl md:text-5xl font-bold text-gray-900 leading-tight">
                        Fuel Your Members with Clinical-Grade Performance Nutrition.
                    </h1>
                    <p className="font-body-md text-sm md:text-base text-gray-500 max-w-2xl mx-auto leading-relaxed">
                        Bring Tanmatra&apos;s zero-seed-oil, macro-calibrated meals directly to your members.
                        Dedicated on-site smart coolers, exclusive 20% member benefits, and revenue sharing.
                    </p>

                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
                        <a href="#partner-form" className="w-full sm:w-auto bg-yellow-500 text-gray-900 font-label-caps text-xs font-bold px-8 py-4 rounded-full hover:opacity-90 active:scale-[0.98] transition-all shadow-sm">
                            Apply for Facility Placement
                        </a>
                        <Link href="/performance" className="w-full sm:w-auto bg-white border border-gray-200 text-gray-900 font-label-caps text-xs font-bold px-8 py-4 rounded-full hover:bg-black/5 active:scale-[0.98] transition-all">
                            View Performance Protocol
                        </Link>
                    </div>
                </div>
            </section>

            <main className="max-w-[1200px] mx-auto px-4 mt-16 space-y-16">
                {/* Benefits Grid */}
                <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm space-y-3">
                        <div className="w-12 h-12 rounded-xl bg-gray-50 border border-gray-200 text-yellow-500 flex items-center justify-center">
                            <span className="material-symbols-outlined text-2xl">kitchen</span>
                        </div>
                        <h3 className="font-headline-md text-base font-bold text-gray-900">Grab-and-Go Smart Coolers</h3>
                        <p className="font-body-sm text-xs text-gray-500 leading-relaxed">
                            Temperature-controlled on-site display coolers stocked daily with high-protein post-workout bowls and electrolyte broths.
                        </p>
                    </div>

                    <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm space-y-3">
                        <div className="w-12 h-12 rounded-xl bg-green-50 text-green-800 flex items-center justify-center">
                            <span className="material-symbols-outlined text-2xl">percent</span>
                        </div>
                        <h3 className="font-headline-md text-base font-bold text-gray-900">20% Exclusive Member Benefit</h3>
                        <p className="font-body-sm text-xs text-gray-500 leading-relaxed">
                            Every active member receives a dedicated partner token granting 20% off all ongoing meal subscriptions.
                        </p>
                    </div>

                    <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm space-y-3">
                        <div className="w-12 h-12 rounded-xl bg-gray-50 border border-gray-200 text-yellow-500 flex items-center justify-center">
                            <span className="material-symbols-outlined text-2xl">payments</span>
                        </div>
                        <h3 className="font-headline-md text-base font-bold text-gray-900">Facility Revenue Share</h3>
                        <p className="font-body-sm text-xs text-gray-500 leading-relaxed">
                            Earn recurrent margin on all subscribed meals and on-site cooler sales originating from your facility.
                        </p>
                    </div>
                </section>

                {/* Partner Form */}
                <section id="partner-form" className="bg-white border border-gray-200 rounded-2xl p-8 shadow-sm max-w-2xl mx-auto space-y-6">
                    <div className="text-center space-y-2">
                        <span className="font-label-caps text-xs text-yellow-500 uppercase tracking-widest font-bold">JOIN THE NETWORK</span>
                        <h2 className="font-headline-md text-2xl font-bold text-gray-900">Apply as a Gym Partner</h2>
                        <p className="font-body-sm text-xs text-gray-500">
                            We deploy on-site infrastructure and member onboarding kits within 5 business days.
                        </p>
                    </div>

                    {submitted ? (
                        <div className="bg-green-50 border border-green-400/30 rounded-2xl p-6 text-center space-y-2">
                            <span className="material-symbols-outlined text-3xl text-green-800">check_circle</span>
                            <h3 className="font-headline-md text-base font-bold text-gray-900">Application Received</h3>
                            <p className="font-body-sm text-xs text-green-800">
                                Our partnerships lead will reach out to {email} to finalize cooler logistics.
                            </p>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="font-body-sm text-xs text-gray-500 block">Gym / Facility Name</label>
                                    <input
                                        type="text"
                                        value={facilityName}
                                        onChange={(e) => setFacilityName(e.target.value)}
                                        placeholder="e.g. Iron Vault Fitness"
                                        required
                                        className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm bg-gray-50 focus:outline-none focus:border-yellow-500"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="font-body-sm text-xs text-gray-500 block">Contact Email</label>
                                    <input
                                        type="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        placeholder="manager@gym.com"
                                        required
                                        className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm bg-gray-50 focus:outline-none focus:border-yellow-500"
                                    />
                                </div>
                            </div>

                            <div className="space-y-1">
                                <label className="font-body-sm text-xs text-gray-500 block">Primary Location</label>
                                <input
                                    type="text"
                                    value={city}
                                    onChange={(e) => setCity(e.target.value)}
                                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm bg-gray-50 focus:outline-none focus:border-yellow-500"
                                />
                            </div>

                            <button
                                type="submit"
                                className="w-full bg-yellow-500 text-gray-900 font-label-caps text-xs font-bold py-3.5 px-6 rounded-full hover:opacity-90 transition-opacity shadow-sm"
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
