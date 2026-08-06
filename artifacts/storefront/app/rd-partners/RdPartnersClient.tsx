"use client";

import React, { useState } from 'react';
import Link from 'next/link';

export default function RdPartnersClient() {
    const [submitted, setSubmitted] = useState(false);
    const [name, setName] = useState('');
    const [credentials, setCredentials] = useState('Registered Dietitian (RD)');
    const [email, setEmail] = useState('');
    const [specialty, setSpecialty] = useState('Metabolic Health & Diabetes');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitted(true);
    };

    return (
        <div className="bg-gray-50 text-gray-900 min-h-screen pb-32">
            {/* Top Navigation */}
            <header className="w-full sticky top-0 bg-gray-50 z-40 border-b border-gray-200 px-4 h-16 flex items-center justify-between max-w-[1200px] mx-auto">
                <Link href="/" className="font-headline-md text-lg font-bold text-yellow-500 tracking-wider">
                    TANMATRA <span className="text-gray-900 text-xs font-normal ml-1 font-label-caps">CLINICAL</span>
                </Link>
                <a href="#rd-form" className="text-xs font-bold bg-yellow-500 text-gray-900 px-4 py-2 rounded-full hover:opacity-90 transition-opacity">
                    Join RD Network
                </a>
            </header>

            {/* Hero Section */}
            <section className="relative w-full min-h-[500px] flex items-center justify-center overflow-hidden border-b border-gray-200 px-4 py-16">
                <div className="max-w-[800px] mx-auto text-center space-y-6">
                    <span className="font-label-caps text-xs text-yellow-500 uppercase tracking-widest font-bold bg-white px-4 py-1.5 rounded-full border border-gray-200 shadow-sm inline-block">
                        REGISTERED DIETITIAN NETWORK
                    </span>
                    <h1 className="font-headline-md text-3xl md:text-5xl font-bold text-gray-900 leading-tight">
                        Prescribe Real Culinary Medicine to Your Patients.
                    </h1>
                    <p className="font-body-md text-sm md:text-base text-gray-500 max-w-2xl mx-auto leading-relaxed">
                        Turn your dietary protocols into freshly cooked, clinical-grade meals delivered directly to your patients&apos; doorsteps.
                        Complete biometric feedback, zero compliance drop-off, and recurring practice revenue.
                    </p>

                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
                        <a href="#rd-form" className="w-full sm:w-auto bg-yellow-500 text-gray-900 font-label-caps text-xs font-bold px-8 py-4 rounded-full hover:opacity-90 active:scale-[0.98] transition-all shadow-sm">
                            Apply for Dietitian Portal
                        </a>
                        <Link href="/clinical" className="w-full sm:w-auto bg-white border border-gray-200 text-gray-900 font-label-caps text-xs font-bold px-8 py-4 rounded-full hover:bg-black/5 active:scale-[0.98] transition-all">
                            View Clinical Governance
                        </Link>
                    </div>
                </div>
            </section>

            <main className="max-w-[1200px] mx-auto px-4 mt-16 space-y-16">
                {/* Benefits */}
                <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm space-y-3">
                        <div className="w-12 h-12 rounded-xl bg-gray-50 border border-gray-200 text-yellow-500 flex items-center justify-center">
                            <span className="material-symbols-outlined text-2xl">prescriptions</span>
                        </div>
                        <h3 className="font-headline-md text-base font-bold text-gray-900">1-Click Protocol Prescriptions</h3>
                        <p className="font-body-sm text-xs text-gray-500 leading-relaxed">
                            Create custom macro protocols (PCOS, Glycemic Control, Renal, Anti-Inflammatory) and send direct checkout links to patients.
                        </p>
                    </div>

                    <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm space-y-3">
                        <div className="w-12 h-12 rounded-xl bg-green-50 text-green-800 flex items-center justify-center">
                            <span className="material-symbols-outlined text-2xl">monitoring</span>
                        </div>
                        <h3 className="font-headline-md text-base font-bold text-gray-900">Patient Compliance Telemetry</h3>
                        <p className="font-body-sm text-xs text-gray-500 leading-relaxed">
                            Monitor meal intake, wearable activity, and symptom logs in real-time before your weekly consultations.
                        </p>
                    </div>

                    <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm space-y-3">
                        <div className="w-12 h-12 rounded-xl bg-gray-50 border border-gray-200 text-yellow-500 flex items-center justify-center">
                            <span className="material-symbols-outlined text-2xl">account_balance_wallet</span>
                        </div>
                        <h3 className="font-headline-md text-base font-bold text-gray-900">Recurring Advisory Revenue</h3>
                        <p className="font-body-sm text-xs text-gray-500 leading-relaxed">
                            Earn recurrent clinical consulting fees on all subscribed meal regimens managed through your practice.
                        </p>
                    </div>
                </section>

                {/* RD Application Form */}
                <section id="rd-form" className="bg-white border border-gray-200 rounded-2xl p-8 shadow-sm max-w-2xl mx-auto space-y-6">
                    <div className="text-center space-y-2">
                        <span className="font-label-caps text-xs text-yellow-500 uppercase tracking-widest font-bold">PRACTICE ONBOARDING</span>
                        <h2 className="font-headline-md text-2xl font-bold text-gray-900">Join the Tanmatra RD Network</h2>
                        <p className="font-body-sm text-xs text-gray-500">
                            We verify credentials and provision your clinical prescription portal within 24 hours.
                        </p>
                    </div>

                    {submitted ? (
                        <div className="bg-green-50 border border-green-400/30 rounded-2xl p-6 text-center space-y-2">
                            <span className="material-symbols-outlined text-3xl text-green-800">verified</span>
                            <h3 className="font-headline-md text-base font-bold text-gray-900">Application Received</h3>
                            <p className="font-body-sm text-xs text-green-800">
                                Our Chief Medical Officer team will review your application and email your provider invite to {email}.
                            </p>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="font-body-sm text-xs text-gray-500 block">Full Name</label>
                                    <input
                                        type="text"
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        placeholder="e.g. Dr. Ananya Sharma, RD"
                                        required
                                        className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm bg-gray-50 focus:outline-none focus:border-yellow-500"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="font-body-sm text-xs text-gray-500 block">Practice Email</label>
                                    <input
                                        type="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        placeholder="ananya@clinic.com"
                                        required
                                        className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm bg-gray-50 focus:outline-none focus:border-yellow-500"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="font-body-sm text-xs text-gray-500 block">Credentials</label>
                                    <input
                                        type="text"
                                        value={credentials}
                                        onChange={(e) => setCredentials(e.target.value)}
                                        className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm bg-gray-50 focus:outline-none focus:border-yellow-500"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="font-body-sm text-xs text-gray-500 block">Clinical Specialty</label>
                                    <select
                                        value={specialty}
                                        onChange={(e) => setSpecialty(e.target.value)}
                                        className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm bg-gray-50 focus:outline-none focus:border-yellow-500"
                                    >
                                        <option value="Metabolic Health & Diabetes">Metabolic Health &amp; Diabetes</option>
                                        <option value="Sports Nutrition & Performance">Sports Nutrition &amp; Performance</option>
                                        <option value="PCOS & Hormonal Health">PCOS &amp; Hormonal Health</option>
                                        <option value="Gut Health & Microbiome">Gut Health &amp; Microbiome</option>
                                        <option value="Renal & Cardiac Care">Renal &amp; Cardiac Care</option>
                                    </select>
                                </div>
                            </div>

                            <button
                                type="submit"
                                className="w-full bg-yellow-500 text-gray-900 font-label-caps text-xs font-bold py-3.5 px-6 rounded-full hover:opacity-90 transition-opacity shadow-sm"
                            >
                                Apply as Clinical Dietitian Partner
                            </button>
                        </form>
                    )}
                </section>
            </main>
        </div>
    );
}
