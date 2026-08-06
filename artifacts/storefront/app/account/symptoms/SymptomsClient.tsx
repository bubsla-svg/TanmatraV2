"use client";

import React, { useState } from 'react';
import Link from 'next/link';

export default function SymptomsClient() {
    const [severity, setSeverity] = useState(3);

    return (
        <div className="bg-gray-50 text-gray-900 antialiased min-h-screen pb-32">
            {/* Top Horizontal Tab Strip */}
            <div className="w-full border-b border-gray-200 bg-gray-50 sticky top-0 z-10">
                <div className="max-w-[1200px] mx-auto px-4 lg:px-10">
                    <div className="flex overflow-x-auto hide-scrollbar items-center space-x-6 h-16">
                        <Link className="font-body-sm text-gray-500 whitespace-nowrap hover:text-gray-900 transition-colors" href="/account/subscriptions">Plans</Link>
                        <Link className="font-body-sm text-gray-500 whitespace-nowrap hover:text-gray-900 transition-colors" href="/account/orders">Orders</Link>
                        <Link className="font-body-sm text-gray-500 whitespace-nowrap hover:text-gray-900 transition-colors" href="/account/appointments">Consults</Link>
                        <Link className="font-body-sm text-gray-500 whitespace-nowrap hover:text-gray-900 transition-colors" href="/account/billing">Billing</Link>
                        <Link className="font-body-sm text-gray-500 whitespace-nowrap hover:text-gray-900 transition-colors" href="/account/addresses">Addresses</Link>
                        <Link className="font-body-sm text-gray-500 whitespace-nowrap hover:text-gray-900 transition-colors" href="/account/preferences">Preferences</Link>
                        <Link className="font-body-sm text-gray-500 whitespace-nowrap hover:text-gray-900 transition-colors" href="/account/wellness">Health</Link>
                        <Link className="font-body-sm text-gray-500 whitespace-nowrap hover:text-gray-900 transition-colors" href="/account/loyalty">Rewards</Link>
                        <Link className="font-body-sm text-gray-900 font-medium whitespace-nowrap border-b-[2px] border-yellow-500 h-full flex items-center" href="/account/symptoms">Symptoms</Link>
                        <Link className="font-body-sm text-gray-500 whitespace-nowrap hover:text-gray-900 transition-colors" href="/account/history">History</Link>
                    </div>
                </div>
            </div>

            {/* Main Content Area */}
            <main className="max-w-[1200px] mx-auto px-4 lg:px-10 py-6 lg:py-10">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-10">

                    {/* LEFT COLUMN (Form) */}
                    <div className="lg:col-span-5 flex flex-col gap-6">
                        <div className="bg-white rounded-xl border border-gray-200 p-6">
                            <h2 className="font-headline-md text-xl mb-6 font-semibold">Symptom Classification</h2>
                            <form className="flex flex-col gap-4">

                                {/* Select Field */}
                                <div className="flex flex-col gap-2">
                                    <label className="font-label-caps text-xs text-gray-500 uppercase tracking-wider">Classification</label>
                                    <div className="relative">
                                        <select className="w-full bg-gray-50 border border-gray-200 rounded-md px-4 py-3 font-body-sm text-gray-900 appearance-none focus:outline-none focus:border-yellow-500 transition-colors">
                                            <option>Post-Meal Bloating &amp; Gas</option>
                                            <option>Acid Reflux</option>
                                            <option>Lethargy</option>
                                            <option>Nausea</option>
                                        </select>
                                        <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none text-[20px]">expand_more</span>
                                    </div>
                                </div>

                                {/* Severity Slider */}
                                <div className="flex flex-col gap-2 mt-3">
                                    <div className="flex justify-between items-center">
                                        <label className="font-label-caps text-xs text-gray-500 uppercase tracking-wider">Reaction Severity</label>
                                        <span className="font-data-md text-gray-900 tabular-nums font-medium">{severity} / 5</span>
                                    </div>
                                    <input
                                        className="w-full h-1 bg-gray-200 rounded-full appearance-none cursor-pointer accent-yellow-500"
                                        max="5"
                                        min="1"
                                        type="range"
                                        value={severity}
                                        onChange={(e) => setSeverity(parseInt(e.target.value))}
                                    />
                                    <div className="flex justify-between w-full px-1">
                                        <span className="font-label-caps text-[9px] text-gray-500 uppercase">MILD</span>
                                        <span className="font-label-caps text-[9px] text-gray-500 uppercase">SEVERE</span>
                                    </div>
                                </div>

                                {/* Related Dish */}
                                <div className="flex flex-col gap-2 mt-3">
                                    <label className="font-label-caps text-xs text-gray-500 uppercase tracking-wider">Related Dish or Meal (Optional)</label>
                                    <input className="w-full bg-gray-50 border border-gray-200 rounded-md px-4 py-3 font-data-md text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-yellow-500 transition-colors tabular-nums" placeholder="e.g. hp-paneer-bowl" type="text" />
                                </div>

                                {/* Clinical Annotations */}
                                <div className="flex flex-col gap-2 mt-3">
                                    <label className="font-label-caps text-xs text-gray-500 uppercase tracking-wider">Clinical Annotations</label>
                                    <textarea className="w-full bg-gray-50 border border-gray-200 rounded-md px-4 py-3 font-body-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-yellow-500 transition-colors resize-none" placeholder="Add specific observation details..." rows={4}></textarea>
                                </div>

                                {/* Submit Button */}
                                <button className="w-full bg-yellow-500 hover:bg-yellow-600 text-gray-900 font-body-sm font-semibold rounded-full py-3 px-6 mt-4 transition-colors flex items-center justify-center gap-2" type="button">
                                    Record Symptom Log
                                    <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                                </button>
                            </form>
                        </div>
                    </div>

                    {/* RIGHT COLUMN (History) */}
                    <div className="lg:col-span-7 flex flex-col gap-6">
                        <h2 className="font-headline-md text-xl mb-2 lg:mb-0 font-semibold">Recorded Symptom History</h2>
                        <div className="flex flex-col gap-4">

                            {/* Card 1 */}
                            <div className="bg-white rounded-xl border border-gray-200 p-6 flex flex-col gap-3">
                                <div className="flex justify-between items-start">
                                    <div className="flex flex-col gap-2">
                                        <span className="inline-flex items-center px-3 py-1 rounded-full bg-green-50 text-green-800 font-label-caps text-[10px] tracking-wider uppercase w-max">BLOATING</span>
                                        <span className="font-body-sm text-gray-500">Oct 24, 2023</span>
                                    </div>
                                    <div className="flex flex-col items-end gap-1">
                                        <span className="font-label-caps text-[10px] text-gray-500 uppercase tracking-wider">Severity</span>
                                        <div className="font-data-md tabular-nums text-gray-500">
                                            <span className="text-yellow-500 font-bold">3</span> / 5
                                        </div>
                                    </div>
                                </div>
                                <div className="font-body-sm text-gray-900">
                                    • Correlated with: <span className="font-data-md tabular-nums text-gray-900">hp-paneer-bowl</span>
                                </div>
                                <div className="h-px w-full bg-gray-200 my-2"></div>
                                <div className="font-body-sm text-gray-500 italic">
                                    &quot;Observed 45m post-consumption.&quot;
                                </div>
                            </div>

                            {/* Card 2 */}
                            <div className="bg-white rounded-xl border border-gray-200 p-6 flex flex-col gap-3">
                                <div className="flex justify-between items-start">
                                    <div className="flex flex-col gap-2">
                                        <span className="inline-flex items-center px-3 py-1 rounded-full bg-green-50 text-green-800 font-label-caps text-[10px] tracking-wider uppercase w-max">ACID REFLUX</span>
                                        <span className="font-body-sm text-gray-500">Oct 22, 2023</span>
                                    </div>
                                    <div className="flex flex-col items-end gap-1">
                                        <span className="font-label-caps text-[10px] text-gray-500 uppercase tracking-wider">Severity</span>
                                        <div className="font-data-md tabular-nums text-gray-500">
                                            <span className="text-yellow-500 font-bold">4</span> / 5
                                        </div>
                                    </div>
                                </div>
                                <div className="font-body-sm text-gray-900">
                                    • Correlated with: <span className="font-data-md tabular-nums text-gray-900">hp-paneer-bowl</span>
                                </div>
                            </div>

                            {/* Card 3 */}
                            <div className="bg-white rounded-xl border border-gray-200 p-6 flex flex-col gap-3">
                                <div className="flex justify-between items-start">
                                    <div className="flex flex-col gap-2">
                                        <span className="inline-flex items-center px-3 py-1 rounded-full bg-green-50 text-green-800 font-label-caps text-[10px] tracking-wider uppercase w-max">LETHARGY</span>
                                        <span className="font-body-sm text-gray-500">Oct 21, 2023</span>
                                    </div>
                                    <div className="flex flex-col items-end gap-1">
                                        <span className="font-label-caps text-[10px] text-gray-500 uppercase tracking-wider">Severity</span>
                                        <div className="font-data-md tabular-nums text-gray-500">
                                            <span className="text-yellow-500 font-bold">2</span> / 5
                                        </div>
                                    </div>
                                </div>
                            </div>

                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
