"use client";

import React from 'react';
import Link from 'next/link';

export default function HistoryClient() {
    return (
        <div className="bg-[#FBFAF7] text-[#1A1C1E] antialiased min-h-screen pb-32">
            {/* Top Navigation Strip */}
            <nav className="sticky top-0 z-50 bg-[#FBFAF7] border-b border-[#E7E3DA] px-4 md:px-8">
                <div className="max-w-[1280px] mx-auto overflow-x-auto hide-scrollbar">
                    <ul className="flex space-x-8 min-w-max h-16 items-center">
                        <li><Link className="text-sm font-medium text-[#5C6367] hover:text-[#1A1C1E] transition-colors" href="/account/subscriptions">Plans</Link></li>
                        <li><Link className="text-sm font-medium text-[#5C6367] hover:text-[#1A1C1E] transition-colors" href="/account/orders">Orders</Link></li>
                        <li><Link className="text-sm font-medium text-[#5C6367] hover:text-[#1A1C1E] transition-colors" href="/account/appointments">Consults</Link></li>
                        <li><Link className="text-sm font-medium text-[#5C6367] hover:text-[#1A1C1E] transition-colors" href="/account/billing">Billing</Link></li>
                        <li><Link className="text-sm font-medium text-[#5C6367] hover:text-[#1A1C1E] transition-colors" href="/account/addresses">Addresses</Link></li>
                        <li><Link className="text-sm font-medium text-[#5C6367] hover:text-[#1A1C1E] transition-colors" href="/account/preferences">Preferences</Link></li>
                        <li><Link className="text-sm font-medium text-[#5C6367] hover:text-[#1A1C1E] transition-colors" href="/account/wellness">Health</Link></li>
                        <li><Link className="text-sm font-medium text-[#5C6367] hover:text-[#1A1C1E] transition-colors" href="/account/loyalty">Rewards</Link></li>
                        <li><Link className="text-sm font-medium text-[#5C6367] hover:text-[#1A1C1E] transition-colors" href="/account/symptoms">Symptoms</Link></li>
                        <li className="relative h-full flex items-center">
                            <Link className="text-sm font-medium text-[#1A1C1E]" href="/account/history">History</Link>
                            <div className="absolute bottom-0 left-0 w-full h-[2px] bg-[#d4af37]"></div>
                        </li>
                    </ul>
                </div>
            </nav>

            {/* Main Content Canvas */}
            <main className="max-w-[1280px] mx-auto px-4 md:px-8 py-8 space-y-12">
                
                {/* Metric Tiles */}
                <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Calorie Adherence */}
                    <div className="bg-white rounded-[2rem] border border-[#E7E3DA] p-8 flex flex-col justify-between">
                        <h3 className="font-body-muted text-sm text-[#5C6367] mb-4">Calorie Adherence</h3>
                        <div>
                            <div className="font-clinical-data text-3xl font-bold tracking-tight mb-1 tabular-nums">4,200 <span className="text-xl font-normal">kcal</span></div>
                            <div className="font-clinical-data text-xs text-[#D4AF37]">Target: 2000/day</div>
                        </div>
                    </div>
                    {/* Protein Volume */}
                    <div className="bg-white rounded-[2rem] border border-[#E7E3DA] p-8 flex flex-col justify-between">
                        <h3 className="font-body-muted text-sm text-[#5C6367] mb-4">Protein Volume</h3>
                        <div>
                            <div className="font-clinical-data text-3xl font-bold tracking-tight mb-1 tabular-nums">168<span className="text-xl font-normal">g</span></div>
                            <div className="font-clinical-data text-xs text-[#D4AF37]">Target: 80g/day</div>
                        </div>
                    </div>
                    {/* Prebiotic Fiber */}
                    <div className="bg-white rounded-[2rem] border border-[#E7E3DA] p-8 flex flex-col justify-between">
                        <h3 className="font-body-muted text-sm text-[#5C6367] mb-4">Prebiotic Fiber</h3>
                        <div>
                            <div className="font-clinical-data text-3xl font-bold tracking-tight mb-1 tabular-nums">96<span className="text-xl font-normal">g</span></div>
                            <div className="font-clinical-data text-xs text-[#D4AF37]">Target: 28g/day</div>
                        </div>
                    </div>
                </section>

                {/* Recent Verified Meal Intake Logs Section */}
                <section>
                    <div className="bg-white rounded-[2rem] border border-[#E7E3DA] overflow-hidden">
                        <div className="p-6 md:p-8 border-b border-[#E7E3DA]">
                            <h2 className="font-headline-md text-xl md:text-2xl font-bold text-[#1A1C1E]">Recent Verified Meal Intake Logs</h2>
                        </div>
                        <div className="divide-y divide-[#E7E3DA]">
                            
                            {/* Log Row 1 */}
                            <div className="p-6 md:p-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
                                <div>
                                    <div className="font-body-base font-medium mb-1 text-[#1A1C1E]">Grilled Paneer Bowl</div>
                                    <div className="font-body-muted text-sm text-[#5C6367]">Logged for: <span className="font-clinical-data">24 Jul 2026</span></div>
                                </div>
                                <div className="font-clinical-data text-sm bg-gray-50 px-4 py-2 rounded-full border border-[#E7E3DA] self-start md:self-auto tabular-nums text-[#1A1C1E]">
                                    420 kcal • 28g Prot • 9g Fiber
                                </div>
                            </div>
                            
                            {/* Log Row 2 */}
                            <div className="p-6 md:p-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
                                <div>
                                    <div className="font-body-base font-medium mb-1 text-[#1A1C1E]">Spirulina Recovery Bowl</div>
                                    <div className="font-body-muted text-sm text-[#5C6367]">Logged for: <span className="font-clinical-data">23 Jul 2026</span></div>
                                </div>
                                <div className="font-clinical-data text-sm bg-gray-50 px-4 py-2 rounded-full border border-[#E7E3DA] self-start md:self-auto tabular-nums text-[#1A1C1E]">
                                    380 kcal • 24g Prot • 12g Fiber
                                </div>
                            </div>
                            
                            {/* Log Row 3 */}
                            <div className="p-6 md:p-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
                                <div>
                                    <div className="font-body-base font-medium mb-1 text-[#1A1C1E]">Turmeric Chicken Quinoa</div>
                                    <div className="font-body-muted text-sm text-[#5C6367]">Logged for: <span className="font-clinical-data">22 Jul 2026</span></div>
                                </div>
                                <div className="font-clinical-data text-sm bg-gray-50 px-4 py-2 rounded-full border border-[#E7E3DA] self-start md:self-auto tabular-nums text-[#1A1C1E]">
                                    450 kcal • 38g Prot • 6g Fiber
                                </div>
                            </div>

                        </div>
                    </div>
                </section>
            </main>
        </div>
    );
}
