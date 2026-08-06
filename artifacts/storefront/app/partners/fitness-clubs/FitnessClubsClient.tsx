"use client";

import React, { useState } from 'react';
import Link from 'next/link';

export default function FitnessClubsClient() {
    const [submitted, setSubmitted] = useState(false);
    const [clubName, setClubName] = useState('');
    const [discipline, setDiscipline] = useState('Running & Marathon');
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
                    TANMATRA <span className="text-gray-900 text-xs font-normal ml-1 font-label-caps">CLUBS</span>
                </Link>
                <a href="#club-form" className="text-xs font-bold bg-yellow-500 text-gray-900 px-4 py-2 rounded-full hover:opacity-90 transition-opacity">
                    Join Network
                </a>
            </header>

            {/* Hero Section */}
            <section className="relative w-full min-h-[500px] flex items-center justify-center overflow-hidden border-b border-gray-200 px-4 py-16">
                <div className="max-w-[800px] mx-auto text-center space-y-6">
                    <span className="font-label-caps text-xs text-yellow-500 uppercase tracking-widest font-bold bg-white px-4 py-1.5 rounded-full border border-gray-200 shadow-sm inline-block">
                        ENDURANCE &amp; BOUTIQUE FITNESS CLUBS
                    </span>
                    <h1 className="font-headline-md text-3xl md:text-5xl font-bold text-gray-900 leading-tight">
                        Power Your Club with Cohort Metabolic Fueling.
                    </h1>
                    <p className="font-body-md text-sm md:text-base text-gray-500 max-w-2xl mx-auto leading-relaxed">
                        Designed for run clubs, triathletes, and CrossFit boxes.
                        Structured race-prep nutrition, team challenge leaderboards, and race-day fueling stations.
                    </p>

                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
                        <a href="#club-form" className="w-full sm:w-auto bg-yellow-500 text-gray-900 font-label-caps text-xs font-bold px-8 py-4 rounded-full hover:opacity-90 active:scale-[0.98] transition-all shadow-sm">
                            Apply for Club Partnership
                        </a>
                        <Link href="/challenges" className="w-full sm:w-auto bg-white border border-gray-200 text-gray-900 font-label-caps text-xs font-bold px-8 py-4 rounded-full hover:bg-black/5 active:scale-[0.98] transition-all">
                            Explore Cohort Challenges
                        </Link>
                    </div>
                </div>
            </section>

            <main className="max-w-[1200px] mx-auto px-4 mt-16 space-y-16">
                {/* Highlights */}
                <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm space-y-3">
                        <div className="w-12 h-12 rounded-xl bg-green-50 text-green-800 flex items-center justify-center">
                            <span className="material-symbols-outlined text-2xl">directions_run</span>
                        </div>
                        <h3 className="font-headline-md text-base font-bold text-gray-900">Race-Day Carb &amp; Glycogen Loading</h3>
                        <p className="font-body-sm text-xs text-gray-500 leading-relaxed">
                            RD-formulated meals precisely timed for marathon cycles, weekend endurance runs, and multi-hour training blocks.
                        </p>
                    </div>

                    <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm space-y-3">
                        <div className="w-12 h-12 rounded-xl bg-gray-50 border border-gray-200 text-yellow-500 flex items-center justify-center">
                            <span className="material-symbols-outlined text-2xl">trophy</span>
                        </div>
                        <h3 className="font-headline-md text-base font-bold text-gray-900">Custom Club Challenges</h3>
                        <p className="font-body-sm text-xs text-gray-500 leading-relaxed">
                            Run private 21-day metabolic resets and macro streaks exclusively for your club members with live leaderboards.
                        </p>
                    </div>

                    <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm space-y-3">
                        <div className="w-12 h-12 rounded-xl bg-gray-50 border border-gray-200 text-yellow-500 flex items-center justify-center">
                            <span className="material-symbols-outlined text-2xl">loyalty</span>
                        </div>
                        <h3 className="font-headline-md text-base font-bold text-gray-900">20% Club Token Discount</h3>
                        <p className="font-body-sm text-xs text-gray-500 leading-relaxed">
                            Club members unlock exclusive partner pricing on all ongoing metabolic meal and recovery subscriptions.
                        </p>
                    </div>
                </section>

                {/* Application Form */}
                <section id="club-form" className="bg-white border border-gray-200 rounded-2xl p-8 shadow-sm max-w-2xl mx-auto space-y-6">
                    <div className="text-center space-y-2">
                        <span className="font-label-caps text-xs text-yellow-500 uppercase tracking-widest font-bold">CLUB REGISTRATION</span>
                        <h2 className="font-headline-md text-2xl font-bold text-gray-900">Partner Your Fitness Club</h2>
                        <p className="font-body-sm text-xs text-gray-500">
                            We set up your club discount code and race-day fueling calendar.
                        </p>
                    </div>

                    {submitted ? (
                        <div className="bg-green-50 border border-green-400/30 rounded-2xl p-6 text-center space-y-2">
                            <span className="material-symbols-outlined text-3xl text-green-800">check_circle</span>
                            <h3 className="font-headline-md text-base font-bold text-gray-900">Club Partnership Registered</h3>
                            <p className="font-body-sm text-xs text-green-800">
                                We will email your custom club token and onboarding kit to {email}.
                            </p>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="font-body-sm text-xs text-gray-500 block">Club Name</label>
                                    <input
                                        type="text"
                                        value={clubName}
                                        onChange={(e) => setClubName(e.target.value)}
                                        placeholder="e.g. Bangalore Striders"
                                        required
                                        className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm bg-gray-50 focus:outline-none focus:border-yellow-500"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="font-body-sm text-xs text-gray-500 block">Club Lead Email</label>
                                    <input
                                        type="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        placeholder="lead@runners.com"
                                        required
                                        className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm bg-gray-50 focus:outline-none focus:border-yellow-500"
                                    />
                                </div>
                            </div>

                            <div className="space-y-1">
                                <label className="font-body-sm text-xs text-gray-500 block">Club Discipline</label>
                                <select
                                    value={discipline}
                                    onChange={(e) => setDiscipline(e.target.value)}
                                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm bg-gray-50 focus:outline-none focus:border-yellow-500"
                                >
                                    <option value="Running & Marathon">Running &amp; Marathon</option>
                                    <option value="Cycling & Triathlon">Cycling &amp; Triathlon</option>
                                    <option value="CrossFit & Functional">CrossFit &amp; Functional Fitness</option>
                                    <option value="Boutique Studio & Pilates">Boutique Studio &amp; Pilates</option>
                                </select>
                            </div>

                            <button
                                type="submit"
                                className="w-full bg-yellow-500 text-gray-900 font-label-caps text-xs font-bold py-3.5 px-6 rounded-full hover:opacity-90 transition-opacity shadow-sm"
                            >
                                Register Club Partnership
                            </button>
                        </form>
                    )}
                </section>
            </main>
        </div>
    );
}
