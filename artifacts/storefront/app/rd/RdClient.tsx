"use client";

import React, { useState } from 'react';
import Link from 'next/link';

interface Dietitian {
    id: string;
    name: string;
    credentials: string;
    specialty: string;
    experience: string;
    avatar: string;
    bio: string;
    availableSlot: string;
}

export default function RdClient() {
    const [selectedSpecialty, setSelectedSpecialty] = useState<string>('all');
    const [bookedRd, setBookedRd] = useState<string | null>(null);

    const dietitians: Dietitian[] = [
        {
            id: 'dr_ananya',
            name: 'Dr. Ananya Sharma',
            credentials: 'PhD, RD, CDE',
            specialty: 'Metabolic & Glycemic Health',
            experience: '12+ yrs clinical practice',
            avatar: 'AS',
            bio: 'Specializes in reversing insulin resistance, postprandial glucose volatility, and metabolic syndrome.',
            availableSlot: 'Tomorrow at 10:00 AM IST'
        },
        {
            id: 'dr_vikram',
            name: 'Vikram Mehta',
            credentials: 'MS, CSSD, RD',
            specialty: 'Sports & Athletic Fueling',
            experience: '9+ yrs athletic advisory',
            avatar: 'VM',
            bio: 'Advises marathoners, triathletes, and CrossFit competitors on glycogen loading and power-to-weight fueling.',
            availableSlot: 'Friday at 4:30 PM IST'
        },
        {
            id: 'dr_priya',
            name: 'Priya Nambiar',
            credentials: 'MSc, RD',
            specialty: 'Hormonal & PCOS Health',
            experience: '8+ yrs integrative nutrition',
            avatar: 'PN',
            bio: 'Expert in dietary hormone balance, inositol sequencing, and anti-inflammatory metabolic diets.',
            availableSlot: 'Thursday at 2:00 PM IST'
        }
    ];

    const filtered = selectedSpecialty === 'all' 
        ? dietitians 
        : dietitians.filter(d => d.specialty.toLowerCase().includes(selectedSpecialty));

    return (
        <div className="bg-[#FBFAF7] text-[#1A1C1E] min-h-screen pb-32">
            {/* Header */}
            <header className="w-full sticky top-0 bg-[#FBFAF7] z-40 border-b border-[#E7E3DA] px-4 h-16 flex items-center justify-between max-w-[1200px] mx-auto">
                <Link href="/" className="font-headline-md text-lg font-bold text-[#D4AF37] tracking-wider">
                    TANMATRA <span className="text-[#1A1C1E] text-xs font-normal ml-1 font-label-caps">CLINICAL DIRECTORY</span>
                </Link>
                <Link href="/account/appointments" className="text-xs font-bold text-[#5C6367] hover:text-[#1A1C1E]">
                    My Scheduled Consults →
                </Link>
            </header>

            <main className="max-w-[1000px] mx-auto px-4 py-10 space-y-10">
                <section className="space-y-3 text-center">
                    <span className="font-label-caps text-xs text-[#D4AF37] uppercase tracking-widest font-bold bg-white px-4 py-1.5 rounded-full border border-[#E7E3DA] shadow-sm inline-block">
                        REGISTERED DIETITIAN ADVISORY BOARD
                    </span>
                    <h1 className="font-headline-md text-3xl md:text-5xl font-bold text-[#1A1C1E]">
                        1-on-1 Clinical Metabolic Consultations
                    </h1>
                    <p className="font-body-md text-sm md:text-base text-[#5C6367] max-w-xl mx-auto leading-relaxed">
                        Every Tanmatra plan includes dedicated 1-on-1 video consultations with board-certified clinical dietitians to calibrate your exact macronutrient thresholds.
                    </p>
                </section>

                {/* Filter Pills */}
                <div className="flex flex-wrap gap-2 justify-center">
                    {['all', 'metabolic', 'sports', 'hormonal'].map(tab => (
                        <button
                            key={tab}
                            onClick={() => setSelectedSpecialty(tab)}
                            className={`px-4 py-2 rounded-full font-label-caps text-xs font-bold uppercase tracking-wider transition-all ${
                                selectedSpecialty === tab 
                                    ? 'bg-[#D4AF37] text-[#1A1C1E] shadow-sm' 
                                    : 'bg-white border border-[#E7E3DA] text-[#5C6367] hover:bg-[#FBFAF7]'
                            }`}
                        >
                            {tab === 'all' ? 'All Specialists' : tab}
                        </button>
                    ))}
                </div>

                {/* Dietitians List */}
                <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {filtered.map(rd => (
                        <div key={rd.id} className="bg-white border border-[#E7E3DA] rounded-3xl p-6 shadow-sm flex flex-col justify-between space-y-6">
                            <div className="space-y-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-12 h-12 rounded-2xl bg-[#FBFAF7] border border-[#E7E3DA] flex items-center justify-center font-bold text-sm text-[#D4AF37]">
                                        {rd.avatar}
                                    </div>
                                    <div>
                                        <h3 className="font-headline-md text-base font-bold text-[#1A1C1E]">{rd.name}</h3>
                                        <span className="font-data-md text-[11px] text-[#4F6B50] font-semibold">{rd.credentials}</span>
                                    </div>
                                </div>

                                <div className="space-y-1 text-xs">
                                    <span className="font-bold text-[#1A1C1E] block">{rd.specialty}</span>
                                    <span className="text-[#8B9194] block">{rd.experience}</span>
                                    <p className="font-body-sm text-[#5C6367] mt-2 leading-relaxed">
                                        {rd.bio}
                                    </p>
                                </div>
                            </div>

                            <div className="space-y-3 pt-3 border-t border-[#E7E3DA]">
                                <div className="font-data-md text-[11px] text-[#5C6367] flex items-center gap-1">
                                    <span className="material-symbols-outlined text-xs text-[#4F6B50]">schedule</span>
                                    Next: {rd.availableSlot}
                                </div>

                                <Link
                                    href="/account/appointments"
                                    className="w-full bg-[#D4AF37] text-[#1A1C1E] font-label-caps text-xs font-bold py-3 px-4 rounded-xl hover:opacity-90 transition-opacity block text-center shadow-sm"
                                >
                                    Book Video Consult
                                </Link>
                            </div>
                        </div>
                    ))}
                </section>
            </main>
        </div>
    );
}
