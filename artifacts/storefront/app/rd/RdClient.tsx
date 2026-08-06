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
        <div className="bg-gray-50 text-gray-900 min-h-screen pb-32">
            {/* Header */}
            <header className="w-full sticky top-0 bg-gray-50 z-40 border-b border-gray-200 px-4 h-16 flex items-center justify-between max-w-[1200px] mx-auto">
                <Link href="/" className="font-headline-md text-lg font-bold text-yellow-500 tracking-wider">
                    TANMATRA <span className="text-gray-900 text-xs font-normal ml-1 font-label-caps">CLINICAL DIRECTORY</span>
                </Link>
                <Link href="/account/appointments" className="text-xs font-bold text-gray-500 hover:text-gray-900">
                    My Scheduled Consults →
                </Link>
            </header>

            <main className="max-w-[1000px] mx-auto px-4 py-10 space-y-10">
                <section className="space-y-3 text-center">
                    <span className="font-label-caps text-xs text-yellow-500 uppercase tracking-widest font-bold bg-white px-4 py-1.5 rounded-full border border-gray-200 shadow-sm inline-block">
                        REGISTERED DIETITIAN ADVISORY BOARD
                    </span>
                    <h1 className="font-headline-md text-3xl md:text-5xl font-bold text-gray-900">
                        1-on-1 Clinical Metabolic Consultations
                    </h1>
                    <p className="font-body-md text-sm md:text-base text-gray-500 max-w-xl mx-auto leading-relaxed">
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
                                    ? 'bg-yellow-500 text-gray-900 shadow-sm'
                                    : 'bg-white border border-gray-200 text-gray-500 hover:bg-gray-50'
                            }`}
                        >
                            {tab === 'all' ? 'All Specialists' : tab}
                        </button>
                    ))}
                </div>

                {/* Dietitians List */}
                <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {filtered.map(rd => (
                        <div key={rd.id} className="bg-white border border-gray-200 rounded-3xl p-6 shadow-sm flex flex-col justify-between space-y-6">
                            <div className="space-y-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-12 h-12 rounded-2xl bg-gray-50 border border-gray-200 flex items-center justify-center font-bold text-sm text-yellow-500">
                                        {rd.avatar}
                                    </div>
                                    <div>
                                        <h3 className="font-headline-md text-base font-bold text-gray-900">{rd.name}</h3>
                                        <span className="font-data-md text-[11px] text-green-800 font-semibold">{rd.credentials}</span>
                                    </div>
                                </div>

                                <div className="space-y-1 text-xs">
                                    <span className="font-bold text-gray-900 block">{rd.specialty}</span>
                                    <span className="text-gray-400 block">{rd.experience}</span>
                                    <p className="font-body-sm text-gray-500 mt-2 leading-relaxed">
                                        {rd.bio}
                                    </p>
                                </div>
                            </div>

                            <div className="space-y-3 pt-3 border-t border-gray-200">
                                <div className="font-data-md text-[11px] text-gray-500 flex items-center gap-1">
                                    <span className="material-symbols-outlined text-xs text-green-800">schedule</span>
                                    Next: {rd.availableSlot}
                                </div>

                                <Link
                                    href="/account/appointments"
                                    className="w-full bg-yellow-500 text-gray-900 font-label-caps text-xs font-bold py-3 px-4 rounded-xl hover:opacity-90 transition-opacity block text-center shadow-sm"
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
