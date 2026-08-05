"use client";

import React, { useState } from 'react';
import Link from 'next/link';

interface CareConditionClientProps {
    condition: string;
}

export default function CareConditionClient({ condition }: CareConditionClientProps) {
    const [showEvidence, setShowEvidence] = useState(false);

    // Format condition name
    const conditionName = condition
        .split('-')
        .map(w => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');

    return (
        <div className="bg-[#FBFAF7] text-[#1A1C1E] min-h-screen pb-32">
            {/* Header */}
            <header className="w-full sticky top-0 bg-[#FBFAF7] z-40 border-b border-[#E7E3DA] px-4 h-16 flex items-center justify-between max-w-[1200px] mx-auto">
                <Link href="/clinical" className="flex items-center gap-2 text-xs font-bold text-[#5C6367] hover:text-[#1A1C1E]">
                    <span className="material-symbols-outlined text-sm">arrow_back</span>
                    All Clinical Protocols
                </Link>
                <div className="flex items-center gap-3">
                    <Link href="/account/appointments" className="text-xs font-bold bg-[#D4AF37] text-[#1A1C1E] px-4 py-2 rounded-full hover:opacity-90 transition-opacity">
                        Consult Condition Specialist
                    </Link>
                </div>
            </header>

            <main className="max-w-[900px] mx-auto px-4 py-10 space-y-12">
                {/* Hero: Outcome Before Clinical Detail */}
                <section className="space-y-4 text-center sm:text-left">
                    <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                        <span className="font-label-caps text-xs text-[#D4AF37] uppercase tracking-widest font-bold bg-white px-3 py-1 rounded-full border border-[#E7E3DA] shadow-sm">
                            CLINICAL CARE PROTOCOL
                        </span>
                        <span className="font-label-caps text-xs text-[#4F6B50] uppercase font-bold bg-[#EBF2EB] px-3 py-1 rounded-full">
                            RD-Verified Program
                        </span>
                    </div>

                    <h1 className="font-headline-md text-3xl md:text-5xl font-bold text-[#1A1C1E] leading-tight">
                        {conditionName} Dietary Management Protocol
                    </h1>
                    <p className="font-body-md text-sm md:text-base text-[#5C6367] max-w-2xl leading-relaxed">
                        A clinical culinary care regimen designed to stabilize target biomarkers, eliminate toxic cooking fats, and nourish long-term metabolic vitality.
                    </p>

                    {/* Target Outcome Metric Highlight */}
                    <div className="mt-6 p-5 bg-white border border-[#E7E3DA] rounded-2xl shadow-sm grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div className="space-y-0.5 text-center sm:text-left">
                            <span className="font-label-caps text-[10px] text-[#8B9194] uppercase tracking-wider block">TARGET OUTCOME</span>
                            <span className="font-data-md text-lg font-bold text-[#4F6B50]">35% Spike Reduction</span>
                            <span className="font-body-sm text-xs text-[#5C6367] block">Within first 14 days</span>
                        </div>
                        <div className="space-y-0.5 text-center sm:text-left">
                            <span className="font-label-caps text-[10px] text-[#8B9194] uppercase tracking-wider block">MACRO PROFILE</span>
                            <span className="font-data-md text-lg font-bold text-[#1A1C1E]">45P · Low-GI · 14F</span>
                            <span className="font-body-sm text-xs text-[#5C6367] block">Strictly calibrated per meal</span>
                        </div>
                        <div className="space-y-0.5 text-center sm:text-left">
                            <span className="font-label-caps text-[10px] text-[#8B9194] uppercase tracking-wider block">RD OVERSIGHT</span>
                            <span className="font-data-md text-lg font-bold text-[#D4AF37]">Bi-Weekly Review</span>
                            <span className="font-body-sm text-xs text-[#5C6367] block">Included with prescription</span>
                        </div>
                    </div>
                </section>

                {/* RD Recommendations vs Personal Preferences distinction */}
                <section className="bg-white border border-[#E7E3DA] rounded-2xl p-6 shadow-sm space-y-4">
                    <div className="flex items-center gap-2 text-sm font-bold text-[#1A1C1E]">
                        <span className="material-symbols-outlined text-[#D4AF37]">verified_user</span>
                        <span>Clinical Prescription vs Personal Culinary Preferences</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                        <div className="p-4 rounded-xl bg-[#EBF2EB] border border-[#7D9E7E]/30 space-y-1">
                            <span className="font-bold text-[#4F6B50] flex items-center gap-1">
                                <span className="material-symbols-outlined text-sm">prescriptions</span>
                                Mandatory Clinical Boundaries
                            </span>
                            <p className="text-[#4F6B50] leading-relaxed">
                                Zero refined seed oils, low glycemic index flours, high beta-glucan prebiotics, and clinical sodium limits are hard constraints.
                            </p>
                        </div>

                        <div className="p-4 rounded-xl bg-[#FBFAF7] border border-[#E7E3DA] space-y-1">
                            <span className="font-bold text-[#1A1C1E] flex items-center gap-1">
                                <span className="material-symbols-outlined text-sm">tune</span>
                                Flexible Personal Preferences
                            </span>
                            <p className="text-[#5C6367] leading-relaxed">
                                Protein sources (Salmon, Grass-fed Steak, Tofu), regional flavor profiles, and meal delivery timings remain 100% customizable.
                            </p>
                        </div>
                    </div>
                </section>

                {/* Progressively Disclosed Clinical Evidence */}
                <section className="bg-white border border-[#E7E3DA] rounded-2xl p-6 shadow-sm space-y-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="font-headline-md text-base font-bold text-[#1A1C1E]">Biochemical Mechanism &amp; Evidence</h3>
                            <p className="font-body-sm text-xs text-[#5C6367]">Progressive clinical disclosure for physicians and patients</p>
                        </div>
                        <button 
                            onClick={() => setShowEvidence(!showEvidence)}
                            className="text-xs font-bold text-[#D4AF37] border border-[#E7E3DA] px-3.5 py-1.5 rounded-full hover:bg-[#FBFAF7] transition-colors"
                        >
                            {showEvidence ? 'Hide Evidence' : 'Expand Clinical Evidence'}
                        </button>
                    </div>

                    {showEvidence && (
                        <div className="p-4 bg-[#FBFAF7] border border-[#E7E3DA] rounded-xl text-xs text-[#5C6367] space-y-3 leading-relaxed">
                            <div>
                                <span className="font-bold text-[#1A1C1E] block mb-1">1. Soluble Fiber Matrix &amp; Incretin Hormone Stimulation</span>
                                <p>Ingestion of high-viscosity polysaccharides stimulates L-cells in the ileum to secrete Glucagon-Like Peptide-1 (GLP-1), enhancing glucose-dependent insulin secretion and augmenting satiety.</p>
                            </div>
                            <div>
                                <span className="font-bold text-[#1A1C1E] block mb-1">2. Mitochondrial Protection via Oleic Acid Dominance</span>
                                <p>Cold-pressed extra virgin olive oil delivers high concentrations of polyphenols (oleocanthal, hydroxytyrosol), mitigating endoplasmic reticulum stress in hepatic and pancreatic beta cells.</p>
                            </div>
                        </div>
                    )}
                </section>

                {/* Plan Configuration CTA */}
                <section className="bg-white border border-[#E7E3DA] rounded-3xl p-8 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-6">
                    <div className="space-y-1">
                        <span className="font-label-caps text-[10px] text-[#D4AF37] uppercase tracking-widest font-bold">READY TO START</span>
                        <h3 className="font-headline-md text-xl font-bold text-[#1A1C1E]">Begin {conditionName} Nutrition Regimen</h3>
                        <p className="font-body-sm text-xs text-[#5C6367]">Cooked fresh daily, delivered to your door with RD consults included.</p>
                    </div>
                    <Link 
                        href={`/plans?condition=${encodeURIComponent(condition)}`}
                        className="w-full sm:w-auto bg-[#D4AF37] text-[#1A1C1E] font-label-caps text-xs font-bold px-8 py-4 rounded-full hover:opacity-90 active:scale-[0.98] transition-all shadow-sm text-center shrink-0"
                    >
                        Configure {conditionName} Plan
                    </Link>
                </section>
            </main>
        </div>
    );
}
