"use client";

import React, { useState } from 'react';
import Link from 'next/link';

interface QaItem {
    id: string;
    category: string;
    question: string;
    answer: string;
    clinicalReference: string;
}

export default function QaClient() {
    const [selectedCategory, setSelectedCategory] = useState('all');
    const [openItem, setOpenItem] = useState<string | null>('1');

    const items: QaItem[] = [
        {
            id: '1',
            category: 'fats',
            question: 'Why does Tanmatra strictly eliminate all industrial seed oils?',
            answer: 'Refined seed oils (soybean, canola, sunflower) are high in polyunsaturated linoleic acid, which oxidizes during industrial high-heat frying, producing toxic lipid aldehydes. We cook exclusively with cold-pressed extra virgin olive oil and A2 grass-fed ghee.',
            clinicalReference: 'Circulation Res 2021; 128: 1478–1495'
        },
        {
            id: '2',
            category: 'glucose',
            question: 'How does plant and fiber sequencing prevent postprandial glucose spikes?',
            answer: 'Consuming high-viscosity soluble fibers (such as beta-glucans and glucomannans) creates an aqueous gel barrier in the intestine, slowing carbohydrate enzymatic cleavage and blunting rapid glucose surges.',
            clinicalReference: 'Diabetes Care 2020; 43(8): 1860–1867'
        },
        {
            id: '3',
            category: 'allergens',
            question: 'How does Tanmatra handle cross-contamination and severe food allergies?',
            answer: 'Every ingredient is logged down to molecular batches. We operate dedicated allergen-segregated prep lines and enforce mandatory exclusions on all customized orders.',
            clinicalReference: 'Tanmatra Clinical Kitchen Protocol §4.2'
        },
        {
            id: '4',
            category: 'rd',
            question: 'Are the meal protocols approved by real medical doctors and dietitians?',
            answer: 'Yes. All recipe macronutrient targets and condition pathways (Diabetes, PCOS, NAFLD) are co-developed and audited by board-certified Registered Dietitians and metabolic physicians.',
            clinicalReference: 'Tanmatra Clinical Advisory Board Charter 2026'
        }
    ];

    const filtered = selectedCategory === 'all'
        ? items
        : items.filter(i => i.category === selectedCategory);

    return (
        <div className="bg-[#FBFAF7] text-[#1A1C1E] min-h-screen pb-32">
            {/* Header */}
            <header className="w-full sticky top-0 bg-[#FBFAF7] z-40 border-b border-[#E7E3DA] px-4 h-16 flex items-center justify-between max-w-[1200px] mx-auto">
                <Link href="/" className="font-headline-md text-lg font-bold text-[#D4AF37] tracking-wider">
                    TANMATRA <span className="text-[#1A1C1E] text-xs font-normal ml-1 font-label-caps">CLINICAL Q&amp;A</span>
                </Link>
                <Link href="/coach" className="text-xs font-bold text-[#5C6367] hover:text-[#1A1C1E]">
                    Ask AI Coach →
                </Link>
            </header>

            <main className="max-w-[800px] mx-auto px-4 py-10 space-y-8">
                <section className="space-y-2 text-center">
                    <span className="font-label-caps text-xs text-[#D4AF37] uppercase tracking-widest font-bold bg-white px-4 py-1.5 rounded-full border border-[#E7E3DA] shadow-sm inline-block">
                        EVIDENCE &amp; TRANSPARENCY
                    </span>
                    <h1 className="font-headline-md text-3xl md:text-4xl font-bold text-[#1A1C1E]">
                        Clinical Knowledgebase &amp; FAQs
                    </h1>
                    <p className="font-body-md text-sm text-[#5C6367] max-w-xl mx-auto">
                        Scientific rationale behind our cooking standards, ingredient sourcing, and metabolic care guidelines.
                    </p>
                </section>

                {/* Category Filters */}
                <div className="flex flex-wrap gap-2 justify-center">
                    {[
                        { id: 'all', label: 'All Topics' },
                        { id: 'fats', label: 'Zero-Seed Oils' },
                        { id: 'glucose', label: 'Glucose & Fiber' },
                        { id: 'allergens', label: 'Allergen Safety' },
                        { id: 'rd', label: 'Clinical Governance' }
                    ].map(cat => (
                        <button
                            key={cat.id}
                            onClick={() => setSelectedCategory(cat.id)}
                            className={`px-4 py-1.5 rounded-full font-label-caps text-xs font-bold transition-all ${
                                selectedCategory === cat.id
                                    ? 'bg-[#D4AF37] text-[#1A1C1E] shadow-sm'
                                    : 'bg-white border border-[#E7E3DA] text-[#5C6367] hover:bg-[#FBFAF7]'
                            }`}
                        >
                            {cat.label}
                        </button>
                    ))}
                </div>

                {/* Q&A Accordion */}
                <div className="space-y-4">
                    {filtered.map(item => (
                        <div key={item.id} className="bg-white border border-[#E7E3DA] rounded-2xl p-5 shadow-sm space-y-3">
                            <button
                                onClick={() => setOpenItem(openItem === item.id ? null : item.id)}
                                className="w-full flex items-center justify-between text-left gap-4 cursor-pointer"
                            >
                                <h3 className="font-headline-md text-base font-bold text-[#1A1C1E]">
                                    {item.question}
                                </h3>
                                <span className="material-symbols-outlined text-sm text-[#D4AF37] shrink-0">
                                    {openItem === item.id ? 'expand_less' : 'expand_more'}
                                </span>
                            </button>

                            {openItem === item.id && (
                                <div className="pt-2 border-t border-[#E7E3DA] space-y-3">
                                    <p className="font-body-sm text-xs text-[#5C6367] leading-relaxed">
                                        {item.answer}
                                    </p>
                                    <div className="font-data-md text-[11px] text-[#8B9194] bg-[#FBFAF7] p-2.5 rounded-xl border border-[#E7E3DA]">
                                        <span className="font-bold text-[#1A1C1E]">Clinical Citation:</span> {item.clinicalReference}
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </main>
        </div>
    );
}
