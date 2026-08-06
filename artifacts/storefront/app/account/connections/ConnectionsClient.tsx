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
        <div className="bg-gray-50 text-gray-900 min-h-screen pb-32">
            {/* Top App Bar & Tab Strip */}
            <header className="w-full sticky top-0 bg-gray-50 z-40 border-b border-gray-200 pt-4">
                <div className="max-w-[1200px] mx-auto px-4">
                    <div className="flex overflow-x-auto hide-scrollbar w-full whitespace-nowrap space-x-6 h-12 items-center">
                        <Link className="text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors" href="/account/subscriptions">Plans</Link>
                        <Link className="text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors" href="/account/orders">Orders</Link>
                        <Link className="text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors" href="/account/appointments">Consults</Link>
                        <Link className="text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors" href="/account/billing">Billing</Link>
                        <Link className="text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors" href="/account/addresses">Addresses</Link>
                        <Link className="text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors" href="/account/preferences">Preferences</Link>
                        <Link className="text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors" href="/account/wellness">Health</Link>
                        <Link className="text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors" href="/account/loyalty">Rewards</Link>
                        <li className="relative list-none h-full flex items-center">
                            <Link className="text-sm font-medium text-gray-900 font-bold" href="/account/connections">Connections</Link>
                            <div className="absolute bottom-0 left-0 w-full h-[2px] bg-yellow-500"></div>
                        </li>
                        <Link className="text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors" href="/account/symptoms">Symptoms</Link>
                        <Link className="text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors" href="/account/history">History</Link>
                    </div>
                </div>
            </header>

            <main className="max-w-[680px] mx-auto px-4 mt-8 space-y-8">
                {/* Intro & Safeguard Notice */}
                <section>
                    <span className="font-label-caps text-xs text-yellow-500 uppercase tracking-widest font-bold">HEALTH TELEMETRY</span>
                    <h1 className="font-headline-md text-2xl md:text-3xl font-bold text-gray-900 mt-1">Connected Devices &amp; Wearables</h1>
                    <p className="font-body-md text-sm text-gray-500 mt-2">
                        Sync physical activity and sleep telemetry to help Tanmatra optimize your metabolic nutrition recommendations.
                    </p>

                    <div className="mt-4 bg-green-50 border border-green-400/30 rounded-2xl p-4 flex gap-3 text-xs text-green-800 leading-relaxed">
                        <span className="material-symbols-outlined text-lg shrink-0 text-green-800">verified_user</span>
                        <div>
                            <span className="font-bold block text-sm mb-0.5 text-gray-900">Strict Privacy &amp; Non-Automated Safeguards</span>
                            Tanmatra uses wearable data strictly to rank and personalize recommended meal options.
                            <strong> Your active scheduled meals are never modified automatically.</strong> Connection is fully optional, and permission denial never blocks plan generation.
                        </div>
                    </div>
                </section>

                {/* Available Providers */}
                <section className="space-y-4">
                    <h2 className="font-label-caps text-xs text-gray-500 uppercase tracking-wider font-bold">SUPPORTED PLATFORMS</h2>

                    <div className="grid grid-cols-1 gap-4">
                        {providers.map(p => (
                            <div key={p.id} className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm space-y-4">
                                <div className="flex items-start justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="w-12 h-12 rounded-xl bg-gray-50 border border-gray-200 flex items-center justify-center text-yellow-500">
                                            <span className="material-symbols-outlined text-2xl">{p.icon}</span>
                                        </div>
                                        <div>
                                            <h3 className="font-headline-md text-base font-bold text-gray-900">{p.name}</h3>
                                            <p className="font-body-sm text-xs text-gray-500">{p.category}</p>
                                        </div>
                                    </div>
                                    {p.connected ? (
                                        <span className="inline-flex items-center gap-1 bg-green-50 text-green-800 font-label-caps text-[10px] px-2.5 py-1 rounded-full uppercase tracking-wider font-bold">
                                            <span className="material-symbols-outlined text-xs">check_circle</span> Connected
                                        </span>
                                    ) : (
                                        <span className="font-body-sm text-xs text-gray-400">Not connected</span>
                                    )}
                                </div>

                                <div className="flex flex-wrap gap-2">
                                    {p.metrics.map(m => (
                                        <span key={m} className="bg-gray-50 border border-gray-200 text-gray-500 text-[11px] px-2.5 py-1 rounded-md font-medium">
                                            {m}
                                        </span>
                                    ))}
                                </div>

                                {p.lastSync && (
                                    <div className="font-data-md text-xs text-gray-400 flex items-center gap-1">
                                        <span className="material-symbols-outlined text-xs">schedule</span> Last synced: {p.lastSync}
                                    </div>
                                )}

                                <button
                                    onClick={() => toggleConnect(p.id)}
                                    className={`w-full py-2.5 px-4 rounded-xl text-xs font-bold transition-all ${
                                        p.connected
                                            ? 'border border-gray-200 text-orange-500 hover:bg-gray-50'
                                            : 'bg-yellow-500 text-gray-900 hover:opacity-90 active:scale-[0.98]'
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
                    <section className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm space-y-5">
                        <div className="flex justify-between items-center">
                            <div>
                                <h3 className="font-headline-md text-base font-bold text-gray-900">Today&apos;s Telemetry Stream</h3>
                                <p className="font-body-sm text-xs text-gray-500">Live telemetry imported from Apple Health</p>
                            </div>
                            <span className="w-2.5 h-2.5 rounded-full bg-green-400 animate-pulse"></span>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 text-center">
                                <span className="font-body-sm text-xs text-gray-500 block">Daily Steps</span>
                                <span className="font-data-md text-lg font-bold text-gray-900 tabular-nums mt-1 block">9,420</span>
                            </div>
                            <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 text-center">
                                <span className="font-body-sm text-xs text-gray-500 block">Active Burn</span>
                                <span className="font-data-md text-lg font-bold text-gray-900 tabular-nums mt-1 block">480 <span className="text-xs font-normal">kcal</span></span>
                            </div>
                            <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 text-center">
                                <span className="font-body-sm text-xs text-gray-500 block">Sleep Duration</span>
                                <span className="font-data-md text-lg font-bold text-gray-900 tabular-nums mt-1 block">7.4 <span className="text-xs font-normal">hrs</span></span>
                            </div>
                            <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 text-center">
                                <span className="font-body-sm text-xs text-gray-500 block">Workouts</span>
                                <span className="font-data-md text-lg font-bold text-gray-900 tabular-nums mt-1 block">4 <span className="text-xs font-normal">this wk</span></span>
                            </div>
                        </div>

                        {/* Explainable Recommendation Rationale */}
                        <div className="bg-gray-50 border-l-4 border-yellow-500 p-4 rounded-r-xl space-y-1">
                            <span className="font-label-caps text-[10px] text-yellow-500 uppercase tracking-wider font-bold">SIGNAL-DRIVEN RECOMMENDATION</span>
                            <p className="font-body-sm text-xs text-gray-900 font-medium">
                                Based on your high active energy burn today (480 kcal), Tanmatra is recommending increased branch-chain amino acid and protein recovery bowls.
                            </p>
                            <p className="font-body-sm text-[11px] text-gray-500">
                                Signal used: Active Energy Expenditure (Apple Health).
                            </p>
                        </div>
                    </section>
                )}

                {/* Influence Permissions */}
                <section className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm space-y-4">
                    <h3 className="font-headline-md text-base font-bold text-gray-900">Recommendation &amp; Plan Influence</h3>
                    <p className="font-body-sm text-xs text-gray-500">
                        Fine-tune how telemetry influences your nutritional suggestions without disconnecting your devices.
                    </p>

                    <div className="space-y-3 pt-2">
                        <label className="flex items-center justify-between p-3 rounded-xl bg-gray-50 border border-gray-200 cursor-pointer">
                            <div className="space-y-0.5">
                                <span className="font-body-sm text-sm font-semibold text-gray-900 block">Influence Meal Recommendations</span>
                                <span className="font-body-sm text-xs text-gray-500 block">Adjust post-workout meal suggestions on high-activity days</span>
                            </div>
                            <input
                                type="checkbox"
                                checked={allowPlanInfluence}
                                onChange={(e) => setAllowPlanInfluence(e.target.checked)}
                                className="w-5 h-5 accent-yellow-500 rounded cursor-pointer"
                            />
                        </label>

                        <label className="flex items-center justify-between p-3 rounded-xl bg-gray-50 border border-gray-200 cursor-pointer">
                            <div className="space-y-0.5">
                                <span className="font-body-sm text-sm font-semibold text-gray-900 block">Weight Trend Telemetry</span>
                                <span className="font-body-sm text-xs text-gray-500 block">Optional weight tracking for long-term metabolic calibration</span>
                            </div>
                            <input
                                type="checkbox"
                                checked={weightSyncEnabled}
                                onChange={(e) => setWeightSyncEnabled(e.target.checked)}
                                className="w-5 h-5 accent-yellow-500 rounded cursor-pointer"
                            />
                        </label>
                    </div>
                </section>
            </main>
        </div>
    );
}
