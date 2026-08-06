"use client";

import React from 'react';
import Link from 'next/link';
import { formatPaise } from '@/lib/format';

export default function PerformanceClient() {
    return (
        <div className="bg-stone-50 text-neutral-900 min-h-screen pb-32">
            {/* Top Bar */}
            <header className="w-full sticky top-0 bg-stone-50 z-40 border-b border-stone-200 px-4 h-16 flex items-center justify-between max-w-[1280px] mx-auto">
                <Link href="/" className="font-headline-md text-lg font-bold text-yellow-600 tracking-wider">
                    TANMATRA
                </Link>
                <div className="flex items-center gap-4">
                    <Link href="/account/connections" className="text-xs font-semibold text-neutral-500 hover:text-neutral-900 flex items-center gap-1">
                        <span className="material-symbols-outlined text-sm text-green-700">watch</span> Wearable Sync
                    </Link>
                    <Link href="/plans" className="text-xs font-bold bg-yellow-600 text-neutral-900 px-4 py-2 rounded-full hover:opacity-90 transition-opacity">
                        View Plans
                    </Link>
                </div>
            </header>

            {/* Hero Section */}
            <section className="relative w-full min-h-[560px] flex items-center justify-center overflow-hidden border-b border-stone-200">
                <div className="absolute inset-0 z-0">
                    <div
                        className="absolute inset-0 bg-cover bg-center"
                        style={{ backgroundImage: "url('https://lh3.googleusercontent.com/aida-public/AB6AXuCkt-HUyTeg8Fr7R-fNfeWHlTez-GGvl6CyJiyp6Oqg3CXBUtzyWIz39CnW-ClPa-cPfgMrQxrX8j4BAW32fWxRdsFqNTZCK7Es4dZAJiD_SHSj-mgekrrIux_t9Rws2gRHfIAfXurckRzxsb6bjMLzqD6dJ8SGyLEN4WzNcCLGCVCz0y5ZJZuiHRw3BihTP5ZZDRyq1t0j4eVFVb1ptLtIVddQ7SUdJhBozk7jyG_m4NmaDCU_2PmXy4J2jGauVa7zd5Ru0OsI9Kc')" }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-stone-50 via-stone-50/75 to-transparent"></div>
                </div>

                <div className="relative z-10 w-full max-w-[1200px] mx-auto px-4 text-center pt-20 pb-12 flex flex-col items-center">
                    <span className="font-label-caps text-xs text-yellow-600 mb-4 uppercase tracking-widest inline-block bg-white/90 backdrop-blur-sm px-4 py-1.5 rounded-full border border-stone-200 font-bold">
                        PERFORMANCE PROTOCOL
                    </span>
                    <h1 className="font-headline-md text-3xl md:text-5xl font-bold text-neutral-900 mb-4 max-w-3xl mx-auto leading-tight">
                        Precision Nutrition for <br/>Peak <span className="text-yellow-600">Performance</span>.
                    </h1>
                    <p className="font-body-md text-sm md:text-base text-neutral-500 mb-8 max-w-xl mx-auto leading-relaxed">
                        Engineered metabolic fueling strategies designed to optimize recovery, endurance, and power output. Clinically calibrated, culinary executed.
                    </p>

                    {/* Telemetry Integration Banner */}
                    <div className="mb-8 bg-white/90 border border-stone-200 rounded-2xl p-4 max-w-lg mx-auto shadow-sm flex items-center justify-between gap-4 text-left">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-green-50 text-green-800 flex items-center justify-center shrink-0">
                                <span className="material-symbols-outlined text-xl">watch</span>
                            </div>
                            <div>
                                <span className="font-bold text-xs text-neutral-900 block">Wearable Telemetry Integrated</span>
                                <span className="text-[11px] text-neutral-500 block">Sync Apple Health or Health Connect to tune training day nutrition.</span>
                            </div>
                        </div>
                        <Link href="/account/connections" className="text-xs font-bold text-yellow-600 hover:underline shrink-0">
                            Connect
                        </Link>
                    </div>

                    <div className="flex flex-col sm:flex-row items-center gap-4 mb-6 w-full max-w-md justify-center">
                        <Link href="/custom-build" className="w-full sm:w-auto bg-yellow-600 text-neutral-900 font-label-caps text-xs font-bold px-8 py-4 rounded-full active:scale-[0.98] transition-transform text-center shadow-sm">
                            Build Custom Fuel Plan
                        </Link>
                        <Link href="/account/appointments" className="w-full sm:w-auto bg-white border border-stone-200 text-neutral-900 font-label-caps text-xs font-bold px-8 py-4 rounded-full hover:bg-black/5 active:scale-[0.98] transition-all text-center">
                            Talk to a Sports RD
                        </Link>
                    </div>

                    <div className="font-data-md text-xs text-neutral-500 bg-white/90 backdrop-blur-sm px-4 py-2 rounded-full border border-stone-200 inline-flex items-center gap-2">
                        <span className="material-symbols-outlined text-sm text-yellow-600">star</span>
                        1,200+ athletes · 4.8 avg protocol rating
                    </div>
                </div>
            </section>

            {/* Benefits Grid */}
            <section className="w-full max-w-[1200px] mx-auto px-4 mt-16">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="flex flex-col items-start p-6 bg-white border border-stone-200 rounded-2xl shadow-sm">
                        <div className="w-12 h-12 rounded-xl bg-stone-50 border border-stone-200 flex items-center justify-center mb-4 text-yellow-600">
                            <span className="material-symbols-outlined text-2xl">bolt</span>
                        </div>
                        <h3 className="font-headline-md text-base font-bold text-neutral-900 mb-2">Metabolic Efficiency</h3>
                        <p className="font-body-sm text-xs text-neutral-500 leading-relaxed">
                            Calibrated macronutrient ratios to train your metabolic flexibility during high-output aerobic and anaerobic training sessions.
                        </p>
                    </div>

                    <div className="flex flex-col items-start p-6 bg-white border border-stone-200 rounded-2xl shadow-sm">
                        <div className="w-12 h-12 rounded-xl bg-stone-50 border border-stone-200 flex items-center justify-center mb-4 text-yellow-600">
                            <span className="material-symbols-outlined text-2xl">favorite</span>
                        </div>
                        <h3 className="font-headline-md text-base font-bold text-neutral-900 mb-2">Accelerated Recovery</h3>
                        <p className="font-body-sm text-xs text-neutral-500 leading-relaxed">
                            Strategic amino acid and micronutrient timing designed to repair muscle micro-tears and replenish glycogen stores faster.
                        </p>
                    </div>

                    <div className="flex flex-col items-start p-6 bg-white border border-stone-200 rounded-2xl shadow-sm">
                        <div className="w-12 h-12 rounded-xl bg-stone-50 border border-stone-200 flex items-center justify-center mb-4 text-yellow-600">
                            <span className="material-symbols-outlined text-2xl">monitoring</span>
                        </div>
                        <h3 className="font-headline-md text-base font-bold text-neutral-900 mb-2">Telemetry-Driven Adaptation</h3>
                        <p className="font-body-sm text-xs text-neutral-500 leading-relaxed">
                            Recommendations adjust based on your daily active energy expenditure and workout frequency without altering your schedule unexpectedly.
                        </p>
                    </div>
                </div>
            </section>

            {/* Protocol Dishes Rail */}
            <section className="w-full max-w-[1200px] mx-auto px-4 mt-16">
                <div className="mb-6 flex justify-between items-end">
                    <div>
                        <span className="font-label-caps text-xs text-yellow-600 uppercase tracking-widest font-bold">CULINARY EXECUTION</span>
                        <h2 className="font-headline-md text-2xl font-bold text-neutral-900 mt-1">Dishes Engineered for Performance</h2>
                    </div>
                    <Link href="/menu" className="text-xs font-bold text-yellow-600 hover:underline">
                        Explore Full Menu →
                    </Link>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Dish 1 */}
                    <div className="bg-white border border-stone-200 rounded-2xl overflow-hidden shadow-sm flex flex-col">
                        <div className="relative aspect-video w-full overflow-hidden bg-stone-200">
                            <img
                                src="https://lh3.googleusercontent.com/aida-public/AB6AXuBew1aGina9KG7AOlpRRb3ZFl2ggbYyHTHqGsGcEHah5haNHMvN4A0pZ786k-uBHz-2sQ5FIhmNhDLl0N_gzdchvakDvimBijTzfUcrVjS0OD0jl_sAXkvjKHs3xkfkK4jFFjICFKBM9pqetSNJEU6L5is9iwRraLiEys48NLMOn1dyIcOVqdh6v36ZWdOr8QHJXrH7Czai_tGAN3qnmq90ywbPSf_RjKDvR0zQPt12Jjwet9R_PooK0T8hbjvlIFky8iVUsuXk-HM"
                                alt="Seared Salmon & Quinoa Bowl"
                                className="w-full h-full object-cover"
                            />
                            <span className="absolute top-3 left-3 bg-white/90 text-neutral-900 font-data-md text-[11px] px-2.5 py-1 rounded-full font-bold shadow-sm">
                                45g Protein
                            </span>
                        </div>
                        <div className="p-5 flex flex-col flex-grow justify-between space-y-3">
                            <div>
                                <h3 className="font-headline-md text-base font-bold text-neutral-900">Wild Salmon &amp; Quinoa Bowl</h3>
                                <p className="font-body-sm text-xs text-neutral-500 mt-1">High omega-3 profile with cold-pressed olive drizzle and steamed greens.</p>
                            </div>
                            <div className="flex justify-between items-center pt-2 border-t border-stone-200">
                                <span className="font-data-md text-xs text-neutral-400">620 kcal · 14g Fiber</span>
                                <span className="font-data-md text-sm font-bold text-neutral-900">{formatPaise(75000)}</span>
                            </div>
                        </div>
                    </div>

                    {/* Dish 2 */}
                    <div className="bg-white border border-stone-200 rounded-2xl overflow-hidden shadow-sm flex flex-col">
                        <div className="relative aspect-video w-full overflow-hidden bg-stone-200">
                            <img
                                src="https://lh3.googleusercontent.com/aida-public/AB6AXuDWvtuKIKewLC4qcrRRUUyVCdrn8OpU_rEhnSrTPCzsDoosAtoEwo9SlhoiV6QvDu_8VWBFnAe1nAptiqS68zKED8lyTdkT655Goa73fIIhzeZ0xd7dzbsCgx7kkkV7pHwmmfGPsCmT8eC4L9h3QyXi7engQWomzrmhvaoDsLPYtVko2R8oXqxkxoEm4bYOjP0hSRtA53m_w5NsvuJX6f-Di1qKb6AqlRu5LB4dCZYfr1gBduv9H2XsOxtrPvsRPXxXaauzKJQ4etA"
                                alt="Lean Steak & Asparagus"
                                className="w-full h-full object-cover"
                            />
                            <span className="absolute top-3 left-3 bg-white/90 text-neutral-900 font-data-md text-[11px] px-2.5 py-1 rounded-full font-bold shadow-sm">
                                52g Protein
                            </span>
                        </div>
                        <div className="p-5 flex flex-col flex-grow justify-between space-y-3">
                            <div>
                                <h3 className="font-headline-md text-base font-bold text-neutral-900">Grass-Fed Steak &amp; Asparagus</h3>
                                <p className="font-body-sm text-xs text-neutral-500 mt-1">Iron-dense protein core with roasted spear asparagus and bone broth reduction.</p>
                            </div>
                            <div className="flex justify-between items-center pt-2 border-t border-stone-200">
                                <span className="font-data-md text-xs text-neutral-400">540 kcal · 12g Fiber</span>
                                <span className="font-data-md text-sm font-bold text-neutral-900">{formatPaise(89000)}</span>
                            </div>
                        </div>
                    </div>

                    {/* Dish 3 */}
                    <div className="bg-white border border-stone-200 rounded-2xl overflow-hidden shadow-sm flex flex-col">
                        <div className="relative aspect-video w-full overflow-hidden bg-stone-200">
                            <img
                                src="https://lh3.googleusercontent.com/aida-public/AB6AXuB9mT2-hmEqhlZxPGWAaBhCqW71A7J4g7rpnFLbm3ebawrUCh1X9DTPMc5xI5qHaF4M5vEVKvaHInqDn_0XSvHRRgiTreJukL7ubqPlCF5KuF2ZYrrlwjjxhh7n0n7pBYfsf_-FvSn-klZyJbeFXI6kDhmOThoYwbxzC2TCDV5QmiTn5j1snyNbyxxNrx0UAMHtX_qdwsGF0L8-kFOylyIWfXDWoUzi5GMdCOAo0-0tZLsce2dmaSYGq66nfgpFe59xi5ahnCIi0-4"
                                alt="Grilled Tofu & Lentil Base"
                                className="w-full h-full object-cover"
                            />
                            <span className="absolute top-3 left-3 bg-green-50 text-green-800 font-data-md text-[11px] px-2.5 py-1 rounded-full font-bold shadow-sm">
                                Plant-Power 28g
                            </span>
                        </div>
                        <div className="p-5 flex flex-col flex-grow justify-between space-y-3">
                            <div>
                                <h3 className="font-headline-md text-base font-bold text-neutral-900">Organic Tofu &amp; Sprouted Lentils</h3>
                                <p className="font-body-sm text-xs text-neutral-500 mt-1">Complete plant protein with sprouted brown lentils and tahini garlic glaze.</p>
                            </div>
                            <div className="flex justify-between items-center pt-2 border-t border-stone-200">
                                <span className="font-data-md text-xs text-neutral-400">480 kcal · 18g Fiber</span>
                                <span className="font-data-md text-sm font-bold text-neutral-900">{formatPaise(62000)}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </section>
        </div>
    );
}
