"use client";

import React, { useState } from 'react';
import Link from 'next/link';

export default function ClinicalClient() {
    const [expandedRationale, setExpandedRationale] = useState<string | null>(null);

    const toggleRationale = (id: string) => {
        setExpandedRationale(prev => prev === id ? null : id);
    };

    return (
        <div className="bg-[#FBFAF7] text-[#1A1C1E] min-h-screen pb-32">
            {/* Navigation */}
            <header className="w-full sticky top-0 bg-[#FBFAF7] z-40 border-b border-[#E7E3DA] px-4 h-16 flex items-center justify-between max-w-[1200px] mx-auto">
                <Link href="/" className="font-headline-md text-lg font-bold text-[#D4AF37] tracking-wider">
                    TANMATRA <span className="text-[#1A1C1E] text-xs font-normal ml-1 font-label-caps">CLINICAL</span>
                </Link>
                <div className="flex items-center gap-3">
                    <Link href="/account/appointments" className="text-xs font-bold bg-[#D4AF37] text-[#1A1C1E] px-4 py-2 rounded-full hover:opacity-90 transition-opacity">
                        Book RD Consult
                    </Link>
                </div>
            </header>

            {/* Hero: Outcome Before Clinical Detail */}
            <section className="relative w-full min-h-[520px] flex items-center justify-center overflow-hidden border-b border-[#E7E3DA] px-4 py-16">
                <div className="max-w-[840px] mx-auto text-center space-y-6">
                    <span className="font-label-caps text-xs text-[#D4AF37] uppercase tracking-widest font-bold bg-white px-4 py-1.5 rounded-full border border-[#E7E3DA] shadow-sm inline-block">
                        CLINICAL GOVERNANCE &amp; CULINARY MEDICINE
                    </span>
                    <h1 className="font-headline-md text-3xl md:text-5xl font-bold text-[#1A1C1E] leading-tight">
                        Targeted Nutrition Protocols Engineered for Measurable Metabolic Outcomes.
                    </h1>
                    <p className="font-body-md text-sm md:text-base text-[#5C6367] max-w-2xl mx-auto leading-relaxed">
                        We translate clinical biochemistry into precision-cooked, zero-seed-oil meals. 
                        Every recipe is calibrated to blunt postprandial glucose surges, restore insulin sensitivity, and nurture microbiome diversity.
                    </p>

                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
                        <Link href="/care/type-2-diabetes" className="w-full sm:w-auto bg-[#D4AF37] text-[#1A1C1E] font-label-caps text-xs font-bold px-8 py-4 rounded-full hover:opacity-90 active:scale-[0.98] transition-all shadow-sm">
                            Explore Care Protocols
                        </Link>
                        <Link href="/rd" className="w-full sm:w-auto bg-white border border-[#E7E3DA] text-[#1A1C1E] font-label-caps text-xs font-bold px-8 py-4 rounded-full hover:bg-black/5 active:scale-[0.98] transition-all">
                            Meet the Clinical RD Board
                        </Link>
                    </div>
                </div>
            </section>

            <main className="max-w-[1200px] mx-auto px-4 mt-16 space-y-16">
                {/* Core Outcomes Grid */}
                <section className="space-y-6">
                    <div className="text-center space-y-2">
                        <span className="font-label-caps text-xs text-[#D4AF37] uppercase tracking-widest font-bold">PRIMARY OBJECTIVES</span>
                        <h2 className="font-headline-md text-2xl md:text-3xl font-bold text-[#1A1C1E]">Outcomes Delivered Through Food</h2>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="bg-white border border-[#E7E3DA] rounded-2xl p-6 shadow-sm space-y-4">
                            <div className="w-12 h-12 rounded-xl bg-[#EBF2EB] text-[#4F6B50] flex items-center justify-center">
                                <span className="material-symbols-outlined text-2xl">monitoring</span>
                            </div>
                            <h3 className="font-headline-md text-base font-bold text-[#1A1C1E]">35% Postprandial Glucose Dampening</h3>
                            <p className="font-body-sm text-xs text-[#5C6367] leading-relaxed">
                                Strategically sequenced prebiotic fiber and organic lipids blunt rapid gastric emptying and prevent glycemic volatility.
                            </p>
                            <button 
                                onClick={() => toggleRationale('glucose')}
                                className="text-xs font-bold text-[#D4AF37] flex items-center gap-1 hover:underline pt-2"
                            >
                                <span>{expandedRationale === 'glucose' ? 'Hide Clinical Rationale' : 'View Clinical Rationale'}</span>
                                <span className="material-symbols-outlined text-sm">{expandedRationale === 'glucose' ? 'expand_less' : 'expand_more'}</span>
                            </button>
                            {expandedRationale === 'glucose' && (
                                <div className="p-3 bg-[#FBFAF7] rounded-xl border border-[#E7E3DA] text-xs text-[#5C6367] leading-relaxed space-y-1">
                                    <p className="font-bold text-[#1A1C1E]">Biochemical Mechanism:</p>
                                    <p>High-viscosity beta-glucans and glucomannans create an aqueous gel barrier along the duodenal epithelium, delaying carbohydrate hydrolysis and glucose absorption kinetics.</p>
                                </div>
                            )}
                        </div>

                        <div className="bg-white border border-[#E7E3DA] rounded-2xl p-6 shadow-sm space-y-4">
                            <div className="w-12 h-12 rounded-xl bg-[#FBFAF7] border border-[#E7E3DA] text-[#D4AF37] flex items-center justify-center">
                                <span className="material-symbols-outlined text-2xl">no_meals_ouline</span>
                            </div>
                            <h3 className="font-headline-md text-base font-bold text-[#1A1C1E]">Zero Industrial Seed Oils</h3>
                            <p className="font-body-sm text-xs text-[#5C6367] leading-relaxed">
                                Eliminating high-linoleic acid refined oils drastically reduces systemic cellular oxidative stress and lipid peroxidation.
                            </p>
                            <button 
                                onClick={() => toggleRationale('oils')}
                                className="text-xs font-bold text-[#D4AF37] flex items-center gap-1 hover:underline pt-2"
                            >
                                <span>{expandedRationale === 'oils' ? 'Hide Clinical Rationale' : 'View Clinical Rationale'}</span>
                                <span className="material-symbols-outlined text-sm">{expandedRationale === 'oils' ? 'expand_less' : 'expand_more'}</span>
                            </button>
                            {expandedRationale === 'oils' && (
                                <div className="p-3 bg-[#FBFAF7] rounded-xl border border-[#E7E3DA] text-xs text-[#5C6367] leading-relaxed space-y-1">
                                    <p className="font-bold text-[#1A1C1E]">Biochemical Mechanism:</p>
                                    <p>Replaced refined soybean/canola oils with cold-pressed EVOO and A2 grass-fed ghee, optimizing the Omega-6 to Omega-3 ratio and protecting mitochondrial membrane fluidity.</p>
                                </div>
                            )}
                        </div>

                        <div className="bg-white border border-[#E7E3DA] rounded-2xl p-6 shadow-sm space-y-4">
                            <div className="w-12 h-12 rounded-xl bg-[#FBFAF7] border border-[#E7E3DA] text-[#D4AF37] flex items-center justify-center">
                                <span className="material-symbols-outlined text-2xl">biotech</span>
                            </div>
                            <h3 className="font-headline-md text-base font-bold text-[#1A1C1E]">Microbiome Keystone Expansion</h3>
                            <p className="font-body-sm text-xs text-[#5C6367] leading-relaxed">
                                30+ distinct botanical species weekly nourish short-chain fatty acid (SCFA) producing commensal gut bacteria.
                            </p>
                            <button 
                                onClick={() => toggleRationale('gut')}
                                className="text-xs font-bold text-[#D4AF37] flex items-center gap-1 hover:underline pt-2"
                            >
                                <span>{expandedRationale === 'gut' ? 'Hide Clinical Rationale' : 'View Clinical Rationale'}</span>
                                <span className="material-symbols-outlined text-sm">{expandedRationale === 'gut' ? 'expand_less' : 'expand_more'}</span>
                            </button>
                            {expandedRationale === 'gut' && (
                                <div className="p-3 bg-[#FBFAF7] rounded-xl border border-[#E7E3DA] text-xs text-[#5C6367] leading-relaxed space-y-1">
                                    <p className="font-bold text-[#1A1C1E]">Biochemical Mechanism:</p>
                                    <p>Targeted resistant starch and polyphenolic compounds stimulate Akkermansia muciniphila and Faecalibacterium prausnitzii, elevating butyrate synthesis and gut barrier integrity.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </section>

                {/* Condition Care Pathways */}
                <section className="bg-white border border-[#E7E3DA] rounded-3xl p-8 shadow-sm space-y-6">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 border-b border-[#E7E3DA] pb-6">
                        <div>
                            <span className="font-label-caps text-xs text-[#D4AF37] uppercase tracking-widest font-bold">CONDITION PATHWAYS</span>
                            <h2 className="font-headline-md text-2xl font-bold text-[#1A1C1E] mt-1">Specific Care Protocols</h2>
                        </div>
                        <Link href="/care/type-2-diabetes" className="text-xs font-bold text-[#D4AF37] hover:underline">
                            View All Conditions →
                        </Link>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                        <Link href="/care/type-2-diabetes" className="p-5 rounded-2xl bg-[#FBFAF7] border border-[#E7E3DA] hover:border-[#D4AF37] transition-all space-y-2 group">
                            <span className="material-symbols-outlined text-2xl text-[#D4AF37]">bloodtype</span>
                            <h4 className="font-headline-md text-sm font-bold text-[#1A1C1E] group-hover:text-[#D4AF37] transition-colors">Type 2 Diabetes &amp; IR</h4>
                            <p className="font-body-sm text-[11px] text-[#5C6367]">Low glycemic index, balanced lipid profiles, complex carb sequencing.</p>
                        </Link>

                        <Link href="/care/pcos" className="p-5 rounded-2xl bg-[#FBFAF7] border border-[#E7E3DA] hover:border-[#D4AF37] transition-all space-y-2 group">
                            <span className="material-symbols-outlined text-2xl text-[#D4AF37]">female</span>
                            <h4 className="font-headline-md text-sm font-bold text-[#1A1C1E] group-hover:text-[#D4AF37] transition-colors">PCOS &amp; Hormonal Balance</h4>
                            <p className="font-body-sm text-[11px] text-[#5C6367]">Anti-inflammatory plant polyphenols and insulin-sensitizing inositols.</p>
                        </Link>

                        <Link href="/care/fatty-liver" className="p-5 rounded-2xl bg-[#FBFAF7] border border-[#E7E3DA] hover:border-[#D4AF37] transition-all space-y-2 group">
                            <span className="material-symbols-outlined text-2xl text-[#D4AF37]">medical_services</span>
                            <h4 className="font-headline-md text-sm font-bold text-[#1A1C1E] group-hover:text-[#D4AF37] transition-colors">NAFLD &amp; Hepatic Reset</h4>
                            <p className="font-body-sm text-[11px] text-[#5C6367]">Choline-rich cruciferous vegetables and zero-fructose savory bases.</p>
                        </Link>

                        <Link href="/care/gut-microbiome" className="p-5 rounded-2xl bg-[#FBFAF7] border border-[#E7E3DA] hover:border-[#D4AF37] transition-all space-y-2 group">
                            <span className="material-symbols-outlined text-2xl text-[#D4AF37]">microbiology</span>
                            <h4 className="font-headline-md text-sm font-bold text-[#1A1C1E] group-hover:text-[#D4AF37] transition-colors">Gut Health &amp; SIBO Care</h4>
                            <p className="font-body-sm text-[11px] text-[#5C6367]">Prebiotic-optimized, FODMAP-calibrated botanical diversity.</p>
                        </Link>
                    </div>
                </section>
            </main>
        </div>
    );
}
