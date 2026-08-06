"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function CorporateWellnessClient() {
    const router = useRouter();
    const [tokenInput, setTokenInput] = useState('');
    const [submittedDemo, setSubmittedDemo] = useState(false);
    const [companyName, setCompanyName] = useState('');
    const [contactEmail, setContactEmail] = useState('');
    const [teamSize, setTeamSize] = useState('50-200');

    const handleRedeemToken = (e: React.FormEvent) => {
        e.preventDefault();
        if (tokenInput.trim()) {
            router.push(`/corporate/invite/${encodeURIComponent(tokenInput.trim())}`);
        }
    };

    const handleDemoSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setSubmittedDemo(true);
    };

    return (
        <div className="bg-gray-50 text-gray-900 min-h-screen pb-32">
            {/* Top Navigation */}
            <header className="w-full sticky top-0 bg-gray-50 z-40 border-b border-gray-200 px-4 h-16 flex items-center justify-between max-w-[1200px] mx-auto">
                <Link href="/" className="font-headline-md text-lg font-bold text-yellow-500 tracking-wider">
                    TANMATRA <span className="text-gray-900 text-xs font-normal ml-1 font-label-caps">ENTERPRISE</span>
                </Link>
                <div className="flex items-center gap-3">
                    <a href="#redeem" className="text-xs font-semibold text-gray-500 hover:text-gray-900">
                        Redeem Token
                    </a>
                    <a href="#pilot" className="text-xs font-bold bg-yellow-500 text-gray-900 px-4 py-2 rounded-full hover:opacity-90 transition-opacity">
                        Request Pilot
                    </a>
                </div>
            </header>

            {/* Hero Section */}
            <section className="relative w-full min-h-[520px] flex items-center justify-center overflow-hidden border-b border-gray-200 px-4 py-16">
                <div className="max-w-[800px] mx-auto text-center space-y-6">
                    <span className="font-label-caps text-xs text-yellow-500 uppercase tracking-widest font-bold bg-white px-4 py-1.5 rounded-full border border-gray-200 shadow-sm inline-block">
                        HIGH-PERFORMANCE ENTERPRISE NUTRITION
                    </span>
                    <h1 className="font-headline-md text-3xl md:text-5xl font-bold text-gray-900 leading-tight">
                        Fueling Peak Cognitive &amp; Physical Output for Teams.
                    </h1>
                    <p className="font-body-md text-sm md:text-base text-gray-500 max-w-2xl mx-auto leading-relaxed">
                        Replace generic catering with clinically calibrated, zero-seed-oil metabolic meals.
                        Fully managed employer subsidies, on-site hot delivery, and executive dietitian consults.
                    </p>

                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
                        <a href="#pilot" className="w-full sm:w-auto bg-yellow-500 text-gray-900 font-label-caps text-xs font-bold px-8 py-4 rounded-full hover:opacity-90 active:scale-[0.98] transition-all shadow-sm">
                            Launch Team Pilot (Free 14-Day Trial)
                        </a>
                        <a href="#redeem" className="w-full sm:w-auto bg-white border border-gray-200 text-gray-900 font-label-caps text-xs font-bold px-8 py-4 rounded-full hover:bg-black/5 active:scale-[0.98] transition-all">
                            Have an Employee Invite?
                        </a>
                    </div>
                </div>
            </section>

            <main className="max-w-[1200px] mx-auto px-4 mt-16 space-y-16">
                {/* Value Pillars */}
                <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm space-y-3">
                        <div className="w-12 h-12 rounded-xl bg-green-50 text-green-800 flex items-center justify-center">
                            <span className="material-symbols-outlined text-2xl">receipt_long</span>
                        </div>
                        <h3 className="font-headline-md text-base font-bold text-gray-900">Flexible Employer Subsidies</h3>
                        <p className="font-body-sm text-xs text-gray-500 leading-relaxed">
                            Subsidize 20% to 100% of employee meal plans with real-time budget controls and centralized monthly corporate billing.
                        </p>
                    </div>

                    <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm space-y-3">
                        <div className="w-12 h-12 rounded-xl bg-gray-50 border border-gray-200 text-yellow-500 flex items-center justify-center">
                            <span className="material-symbols-outlined text-2xl">skillet</span>
                        </div>
                        <h3 className="font-headline-md text-base font-bold text-gray-900">Zero-Seed-Oil Clinical Kitchens</h3>
                        <p className="font-body-sm text-xs text-gray-500 leading-relaxed">
                            Cooked exclusively with cold-pressed extra virgin olive oil, grass-fed ghee, and organic whole foods. No post-lunch energy crashes.
                        </p>
                    </div>

                    <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm space-y-3">
                        <div className="w-12 h-12 rounded-xl bg-gray-50 border border-gray-200 text-yellow-500 flex items-center justify-center">
                            <span className="material-symbols-outlined text-2xl">health_and_safety</span>
                        </div>
                        <h3 className="font-headline-md text-base font-bold text-gray-900">RD-Led Metabolic Advisory</h3>
                        <p className="font-body-sm text-xs text-gray-500 leading-relaxed">
                            Employees receive 1-on-1 metabolic coaching and personalized biomarker guidance from registered clinical dietitians.
                        </p>
                    </div>
                </section>

                {/* Redeem Token Section */}
                <section id="redeem" className="bg-white border border-gray-200 rounded-2xl p-8 shadow-sm max-w-xl mx-auto space-y-4 text-center">
                    <span className="font-label-caps text-xs text-yellow-500 uppercase tracking-widest font-bold">EMPLOYEE ONBOARDING</span>
                    <h2 className="font-headline-md text-2xl font-bold text-gray-900">Redeem Company Access Token</h2>
                    <p className="font-body-sm text-xs text-gray-500">
                        Enter your corporate authorization code (e.g. <code className="bg-gray-50 px-1.5 py-0.5 rounded text-gray-900">token_corp_google</code>) to unlock your subsidized plan.
                    </p>

                    <form onSubmit={handleRedeemToken} className="flex gap-2 pt-2">
                        <input
                            type="text"
                            value={tokenInput}
                            onChange={(e) => setTokenInput(e.target.value)}
                            placeholder="Enter token..."
                            className="flex-grow px-4 py-3 rounded-xl border border-gray-200 text-sm bg-gray-50 focus:outline-none focus:border-yellow-500"
                            required
                        />
                        <button type="submit" className="bg-yellow-500 text-gray-900 font-label-caps text-xs font-bold px-6 py-3 rounded-xl hover:opacity-90 transition-opacity">
                            Verify
                        </button>
                    </form>
                </section>

                {/* Pilot / Demo Request Form */}
                <section id="pilot" className="bg-white border border-gray-200 rounded-2xl p-8 shadow-sm max-w-2xl mx-auto space-y-6">
                    <div className="text-center space-y-2">
                        <span className="font-label-caps text-xs text-yellow-500 uppercase tracking-widest font-bold">GET STARTED</span>
                        <h2 className="font-headline-md text-2xl font-bold text-gray-900">Request an Enterprise Tasting &amp; Pilot</h2>
                        <p className="font-body-sm text-xs text-gray-500">
                            We will coordinate a hot tasting for your leadership team and configure your corporate subsidy portal.
                        </p>
                    </div>

                    {submittedDemo ? (
                        <div className="bg-green-50 border border-green-400/30 rounded-2xl p-6 text-center space-y-2">
                            <span className="material-symbols-outlined text-3xl text-green-800">verified</span>
                            <h3 className="font-headline-md text-base font-bold text-gray-900">Pilot Request Received</h3>
                            <p className="font-body-sm text-xs text-green-800">
                                Our corporate wellness team will contact you at {contactEmail} within 2 business hours.
                            </p>
                        </div>
                    ) : (
                        <form onSubmit={handleDemoSubmit} className="space-y-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="font-body-sm text-xs text-gray-500 block">Company Name</label>
                                    <input
                                        type="text"
                                        value={companyName}
                                        onChange={(e) => setCompanyName(e.target.value)}
                                        placeholder="e.g. Acme Tech"
                                        required
                                        className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm bg-gray-50 focus:outline-none focus:border-yellow-500"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="font-body-sm text-xs text-gray-500 block">Work Email</label>
                                    <input
                                        type="email"
                                        value={contactEmail}
                                        onChange={(e) => setContactEmail(e.target.value)}
                                        placeholder="you@company.com"
                                        required
                                        className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm bg-gray-50 focus:outline-none focus:border-yellow-500"
                                    />
                                </div>
                            </div>

                            <div className="space-y-1">
                                <label className="font-body-sm text-xs text-gray-500 block">Team Size</label>
                                <select
                                    value={teamSize}
                                    onChange={(e) => setTeamSize(e.target.value)}
                                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm bg-gray-50 focus:outline-none focus:border-yellow-500"
                                >
                                    <option value="10-50">10 – 50 Employees</option>
                                    <option value="50-200">50 – 200 Employees</option>
                                    <option value="200-1000">200 – 1,000 Employees</option>
                                    <option value="1000+">1,000+ Enterprise</option>
                                </select>
                            </div>

                            <button
                                type="submit"
                                className="w-full bg-yellow-500 text-gray-900 font-label-caps text-xs font-bold py-3.5 px-6 rounded-full hover:opacity-90 transition-opacity shadow-sm"
                            >
                                Schedule Corporate Tasting
                            </button>
                        </form>
                    )}
                </section>
            </main>
        </div>
    );
}
