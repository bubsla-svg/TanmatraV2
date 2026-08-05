"use client";

import React, { useState } from 'react';
import Link from 'next/link';

interface Provider {
    id: string;
    name: string;
    icon: string;
    category: string;
    connected: boolean;
    lastSync?: string;
    metrics: string[];
}

export default function ConnectionsClient() {
    const [providers, setProviders] = useState<Provider[]>([
        {
            id: 'apple-health',
            name: 'Apple Health',
            icon: 'health_and_safety',
            category: 'iOS & Apple Watch Sync',
            connected: true,
            lastSync: 'Today, 11:30 AM',
            metrics: ['Steps', 'Workouts', 'Active Energy', 'Sleep Duration']
        },
        {
            id: 'health-connect',
            name: 'Android Health Connect',
            icon: 'sync_saved_locally',
            category: 'Android OS & Wear OS Sync',
            connected: false,
            metrics: ['Daily Steps', 'Workouts', 'Rest Metrics']
        }
    ]);

    const [allowPlanInfluence, setAllowPlanInfluence] = useState(true);
    const [weightSyncEnabled, setWeightSyncEnabled] = useState(true);

    const toggleConnect = (id: string) => {
        setProviders(prev => prev.map(p => {
            if (p.id === id) {
                const nextConnected = !p.connected;
                return {
                    ...p,
                    connected: nextConnected,
                    lastSync: nextConnected ? 'Just now' : undefined
                };
            }
            return p;
        }));
    };

    const isAnyConnected = providers.some(p => p.connected);

    return (
        <div className="bg-[#FBFAF7] text-[#1A1C1E] min-h-screen pb-32">
            {/* Top App Bar & Tab Strip */}
            <header className="w-full sticky top-0 bg-[#FBFAF7] z-40 border-b border-[#E7E3DA] pt-4">
                <div className="max-w-[1200px] mx-auto px-4">
                    <div className="flex overflow-x-auto hide-scrollbar w-full whitespace-nowrap space-x-6 h-12 items-center">
                        <Link className="text-sm font-medium text-[#5C6367] hover:text-[#1A1C1E] transition-colors" href="/account/subscriptions">Plans</Link>
                        <Link className="text-sm font-medium text-[#5C6367] hover:text-[#1A1C1E] transition-colors" href="/account/orders">Orders</Link>
                        <Link className="text-sm font-medium text-[#5C6367] hover:text-[#1A1C1E] transition-colors" href="/account/appointments">Consults</Link>
                        <Link className="text-sm font-medium text-[#5C6367] hover:text-[#1A1C1E] transition-colors" href="/account/billing">Billing</Link>
                        <Link className="text-sm font-medium text-[#5C6367] hover:text-[#1A1C1E] transition-colors" href="/account/addresses">Addresses</Link>
                        <Link className="text-sm font-medium text-[#5C6367] hover:text-[#1A1C1E] transition-colors" href="/account/preferences">Preferences</Link>
                        <Link className="text-sm font-medium text-[#5C6367] hover:text-[#1A1C1E] transition-colors" href="/account/wellness">Health</Link>
                        <Link className="text-sm font-medium text-[#5C6367] hover:text-[#1A1C1E] transition-colors" href="/account/loyalty">Rewards</Link>
                        <li className="relative list-none h-full flex items-center">
                            <Link className="text-sm font-medium text-[#1A1C1E] font-bold" href="/account/connections">Connections</Link>
                            <div className="absolute bottom-0 left-0 w-full h-[2px] bg-[#D4AF37]"></div>
                        </li>
                        <Link className="text-sm font-medium text-[#5C6367] hover:text-[#1A1C1E] transition-colors" href="/account/symptoms">Symptoms</Link>
                        <Link className="text-sm font-medium text-[#5C6367] hover:text-[#1A1C1E] transition-colors" href="/account/history">History</Link>
                    </div>
                </div>
            </header>

            <main className="max-w-[680px] mx-auto px-4 mt-8 space-y-8">
                {/* Intro & Safeguard Notice */}
                <section>
                    <span className="font-label-caps text-xs text-[#D4AF37] uppercase tracking-widest font-bold">HEALTH TELEMETRY</span>
                    <h1 className="font-headline-md text-2xl md:text-3xl font-bold text-[#1A1C1E] mt-1">Connected Devices &amp; Wearables</h1>
                    <p className="font-body-md text-sm text-[#5C6367] mt-2">
                        Sync physical activity and sleep telemetry to help Tanmatra optimize your metabolic nutrition recommendations.
                    </p>

                    <div className="mt-4 bg-[#EBF2EB] border border-[#7D9E7E]/30 rounded-2xl p-4 flex gap-3 text-xs text-[#4F6B50] leading-relaxed">
                        <span className="material-symbols-outlined text-lg shrink-0 text-[#4F6B50]">verified_user</span>
                        <div>
                            <span className="font-bold block text-sm mb-0.5 text-[#1A1C1E]">Strict Privacy &amp; Non-Automated Safeguards</span>
                            Tanmatra uses wearable data strictly to rank and personalize recommended meal options. 
                            <strong> Your active scheduled meals are never modified automatically.</strong> Connection is fully optional, and permission denial never blocks plan generation.
                        </div>
                    </div>
                </section>

                {/* Available Providers */}
                <section className="space-y-4">
                    <h2 className="font-label-caps text-xs text-[#5C6367] uppercase tracking-wider font-bold">SUPPORTED PLATFORMS</h2>
                    
                    <div className="grid grid-cols-1 gap-4">
                        {providers.map(p => (
                            <div key={p.id} className="bg-white border border-[#E7E3DA] rounded-2xl p-5 shadow-sm space-y-4">
                                <div className="flex items-start justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="w-12 h-12 rounded-xl bg-[#FBFAF7] border border-[#E7E3DA] flex items-center justify-center text-[#D4AF37]">
                                            <span className="material-symbols-outlined text-2xl">{p.icon}</span>
                                        </div>
                                        <div>
                                            <h3 className="font-headline-md text-base font-bold text-[#1A1C1E]">{p.name}</h3>
                                            <p className="font-body-sm text-xs text-[#5C6367]">{p.category}</p>
                                        </div>
                                    </div>
                                    {p.connected ? (
                                        <span className="inline-flex items-center gap-1 bg-[#EBF2EB] text-[#4F6B50] font-label-caps text-[10px] px-2.5 py-1 rounded-full uppercase tracking-wider font-bold">
                                            <span className="material-symbols-outlined text-xs">check_circle</span> Connected
                                        </span>
                                    ) : (
                                        <span className="font-body-sm text-xs text-[#8B9194]">Not connected</span>
                                    )}
                                </div>

                                <div className="flex flex-wrap gap-2">
                                    {p.metrics.map(m => (
                                        <span key={m} className="bg-[#FBFAF7] border border-[#E7E3DA] text-[#5C6367] text-[11px] px-2.5 py-1 rounded-md font-medium">
                                            {m}
                                        </span>
                                    ))}
                                </div>

                                {p.lastSync && (
                                    <div className="font-data-md text-xs text-[#8B9194] flex items-center gap-1">
                                        <span className="material-symbols-outlined text-xs">schedule</span> Last synced: {p.lastSync}
                                    </div>
                                )}

                                <button
                                    onClick={() => toggleConnect(p.id)}
                                    className={`w-full py-2.5 px-4 rounded-xl text-xs font-bold transition-all ${
                                        p.connected 
                                            ? 'border border-[#E7E3DA] text-[#C2603F] hover:bg-[#FBFAF7]' 
                                            : 'bg-[#D4AF37] text-[#1A1C1E] hover:opacity-90 active:scale-[0.98]'
                                    }`}
                                >
                                    {p.connected ? 'Disconnect Device' : 'Connect Platform'}
                                </button>
                            </div>
                        ))}
                    </div>
                </section>

                {/* Telemetry Summary & Signal Transparency (if connected) */}
                {isAnyConnected && (
                    <section className="bg-white border border-[#E7E3DA] rounded-2xl p-6 shadow-sm space-y-5">
                        <div className="flex justify-between items-center">
                            <div>
                                <h3 className="font-headline-md text-base font-bold text-[#1A1C1E]">Today&apos;s Telemetry Stream</h3>
                                <p className="font-body-sm text-xs text-[#5C6367]">Live telemetry imported from Apple Health</p>
                            </div>
                            <span className="w-2.5 h-2.5 rounded-full bg-[#7D9E7E] animate-pulse"></span>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            <div className="bg-[#FBFAF7] border border-[#E7E3DA] rounded-xl p-3 text-center">
                                <span className="font-body-sm text-xs text-[#5C6367] block">Daily Steps</span>
                                <span className="font-data-md text-lg font-bold text-[#1A1C1E] tabular-nums mt-1 block">9,420</span>
                            </div>
                            <div className="bg-[#FBFAF7] border border-[#E7E3DA] rounded-xl p-3 text-center">
                                <span className="font-body-sm text-xs text-[#5C6367] block">Active Burn</span>
                                <span className="font-data-md text-lg font-bold text-[#1A1C1E] tabular-nums mt-1 block">480 <span className="text-xs font-normal">kcal</span></span>
                            </div>
                            <div className="bg-[#FBFAF7] border border-[#E7E3DA] rounded-xl p-3 text-center">
                                <span className="font-body-sm text-xs text-[#5C6367] block">Sleep Duration</span>
                                <span className="font-data-md text-lg font-bold text-[#1A1C1E] tabular-nums mt-1 block">7.4 <span className="text-xs font-normal">hrs</span></span>
                            </div>
                            <div className="bg-[#FBFAF7] border border-[#E7E3DA] rounded-xl p-3 text-center">
                                <span className="font-body-sm text-xs text-[#5C6367] block">Workouts</span>
                                <span className="font-data-md text-lg font-bold text-[#1A1C1E] tabular-nums mt-1 block">4 <span className="text-xs font-normal">this wk</span></span>
                            </div>
                        </div>

                        {/* Explainable Recommendation Rationale */}
                        <div className="bg-[#FBFAF7] border-l-4 border-[#D4AF37] p-4 rounded-r-xl space-y-1">
                            <span className="font-label-caps text-[10px] text-[#D4AF37] uppercase tracking-wider font-bold">SIGNAL-DRIVEN RECOMMENDATION</span>
                            <p className="font-body-sm text-xs text-[#1A1C1E] font-medium">
                                Based on your high active energy burn today (480 kcal), Tanmatra is recommending increased branch-chain amino acid and protein recovery bowls.
                            </p>
                            <p className="font-body-sm text-[11px] text-[#5C6367]">
                                Signal used: Active Energy Expenditure (Apple Health).
                            </p>
                        </div>
                    </section>
                )}

                {/* Influence Permissions */}
                <section className="bg-white border border-[#E7E3DA] rounded-2xl p-6 shadow-sm space-y-4">
                    <h3 className="font-headline-md text-base font-bold text-[#1A1C1E]">Recommendation &amp; Plan Influence</h3>
                    <p className="font-body-sm text-xs text-[#5C6367]">
                        Fine-tune how telemetry influences your nutritional suggestions without disconnecting your devices.
                    </p>

                    <div className="space-y-3 pt-2">
                        <label className="flex items-center justify-between p-3 rounded-xl bg-[#FBFAF7] border border-[#E7E3DA] cursor-pointer">
                            <div className="space-y-0.5">
                                <span className="font-body-sm text-sm font-semibold text-[#1A1C1E] block">Influence Meal Recommendations</span>
                                <span className="font-body-sm text-xs text-[#5C6367] block">Adjust post-workout meal suggestions on high-activity days</span>
                            </div>
                            <input 
                                type="checkbox" 
                                checked={allowPlanInfluence} 
                                onChange={(e) => setAllowPlanInfluence(e.target.checked)}
                                className="w-5 h-5 accent-[#D4AF37] rounded cursor-pointer"
                            />
                        </label>

                        <label className="flex items-center justify-between p-3 rounded-xl bg-[#FBFAF7] border border-[#E7E3DA] cursor-pointer">
                            <div className="space-y-0.5">
                                <span className="font-body-sm text-sm font-semibold text-[#1A1C1E] block">Weight Trend Telemetry</span>
                                <span className="font-body-sm text-xs text-[#5C6367] block">Optional weight tracking for long-term metabolic calibration</span>
                            </div>
                            <input 
                                type="checkbox" 
                                checked={weightSyncEnabled} 
                                onChange={(e) => setWeightSyncEnabled(e.target.checked)}
                                className="w-5 h-5 accent-[#D4AF37] rounded cursor-pointer"
                            />
                        </label>
                    </div>
                </section>
            </main>
        </div>
    );
}
