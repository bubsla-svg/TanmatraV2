"use client";

import React, { useState } from 'react';
import Link from 'next/link';

export default function SymptomsClient() {
    const [severity, setSeverity] = useState(3);

    return (
        <div className="bg-[#FBFAF7] text-[#1A1C1E] antialiased min-h-screen pb-32">
            {/* Top Horizontal Tab Strip */}
            <div className="w-full border-b border-[#E7E3DA] bg-[#FBFAF7] sticky top-0 z-10">
                <div className="max-w-[1200px] mx-auto px-4 lg:px-10">
                    <div className="flex overflow-x-auto hide-scrollbar items-center space-x-6 h-16">
                        <Link className="font-body-sm text-[#5C6367] whitespace-nowrap hover:text-[#1A1C1E] transition-colors" href="/account/subscriptions">Plans</Link>
                        <Link className="font-body-sm text-[#5C6367] whitespace-nowrap hover:text-[#1A1C1E] transition-colors" href="/account/orders">Orders</Link>
                        <Link className="font-body-sm text-[#5C6367] whitespace-nowrap hover:text-[#1A1C1E] transition-colors" href="/account/appointments">Consults</Link>
                        <Link className="font-body-sm text-[#5C6367] whitespace-nowrap hover:text-[#1A1C1E] transition-colors" href="/account/billing">Billing</Link>
                        <Link className="font-body-sm text-[#5C6367] whitespace-nowrap hover:text-[#1A1C1E] transition-colors" href="/account/addresses">Addresses</Link>
                        <Link className="font-body-sm text-[#5C6367] whitespace-nowrap hover:text-[#1A1C1E] transition-colors" href="/account/preferences">Preferences</Link>
                        <Link className="font-body-sm text-[#5C6367] whitespace-nowrap hover:text-[#1A1C1E] transition-colors" href="/account/wellness">Health</Link>
                        <Link className="font-body-sm text-[#5C6367] whitespace-nowrap hover:text-[#1A1C1E] transition-colors" href="/account/loyalty">Rewards</Link>
                        <Link className="font-body-sm text-[#1A1C1E] font-medium whitespace-nowrap border-b-[2px] border-[#D4AF37] h-full flex items-center" href="/account/symptoms">Symptoms</Link>
                        <Link className="font-body-sm text-[#5C6367] whitespace-nowrap hover:text-[#1A1C1E] transition-colors" href="/account/history">History</Link>
                    </div>
                </div>
            </div>

            {/* Main Content Area */}
            <main className="max-w-[1200px] mx-auto px-4 lg:px-10 py-6 lg:py-10">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-10">
                    
                    {/* LEFT COLUMN (Form) */}
                    <div className="lg:col-span-5 flex flex-col gap-6">
                        <div className="bg-white rounded-xl border border-[#E7E3DA] p-6">
                            <h2 className="font-headline-md text-xl mb-6 font-semibold">Symptom Classification</h2>
                            <form className="flex flex-col gap-4">
                                
                                {/* Select Field */}
                                <div className="flex flex-col gap-2">
                                    <label className="font-label-caps text-xs text-[#5C6367] uppercase tracking-wider">Classification</label>
                                    <div className="relative">
                                        <select className="w-full bg-[#FBFAF7] border border-[#E7E3DA] rounded-md px-4 py-3 font-body-sm text-[#1A1C1E] appearance-none focus:outline-none focus:border-[#D4AF37] transition-colors">
                                            <option>Post-Meal Bloating &amp; Gas</option>
                                            <option>Acid Reflux</option>
                                            <option>Lethargy</option>
                                            <option>Nausea</option>
                                        </select>
                                        <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 text-[#5C6367] pointer-events-none text-[20px]">expand_more</span>
                                    </div>
                                </div>
                                
                                {/* Severity Slider */}
                                <div className="flex flex-col gap-2 mt-3">
                                    <div className="flex justify-between items-center">
                                        <label className="font-label-caps text-xs text-[#5C6367] uppercase tracking-wider">Reaction Severity</label>
                                        <span className="font-data-md text-[#1A1C1E] tabular-nums font-medium">{severity} / 5</span>
                                    </div>
                                    <input 
                                        className="w-full h-1 bg-[#E7E3DA] rounded-full appearance-none cursor-pointer accent-[#D4AF37]" 
                                        max="5" 
                                        min="1" 
                                        type="range" 
                                        value={severity}
                                        onChange={(e) => setSeverity(parseInt(e.target.value))}
                                    />
                                    <div className="flex justify-between w-full px-1">
                                        <span className="font-label-caps text-[9px] text-[#5C6367] uppercase">MILD</span>
                                        <span className="font-label-caps text-[9px] text-[#5C6367] uppercase">SEVERE</span>
                                    </div>
                                </div>
                                
                                {/* Related Dish */}
                                <div className="flex flex-col gap-2 mt-3">
                                    <label className="font-label-caps text-xs text-[#5C6367] uppercase tracking-wider">Related Dish or Meal (Optional)</label>
                                    <input className="w-full bg-[#FBFAF7] border border-[#E7E3DA] rounded-md px-4 py-3 font-data-md text-[#1A1C1E] placeholder:text-[#8B9194] focus:outline-none focus:border-[#D4AF37] transition-colors tabular-nums" placeholder="e.g. hp-paneer-bowl" type="text" />
                                </div>
                                
                                {/* Clinical Annotations */}
                                <div className="flex flex-col gap-2 mt-3">
                                    <label className="font-label-caps text-xs text-[#5C6367] uppercase tracking-wider">Clinical Annotations</label>
                                    <textarea className="w-full bg-[#FBFAF7] border border-[#E7E3DA] rounded-md px-4 py-3 font-body-sm text-[#1A1C1E] placeholder:text-[#8B9194] focus:outline-none focus:border-[#D4AF37] transition-colors resize-none" placeholder="Add specific observation details..." rows={4}></textarea>
                                </div>
                                
                                {/* Submit Button */}
                                <button className="w-full bg-[#D4AF37] hover:bg-[#C5A333] text-[#1A1C1E] font-body-sm font-semibold rounded-full py-3 px-6 mt-4 transition-colors flex items-center justify-center gap-2" type="button">
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
                            <div className="bg-white rounded-xl border border-[#E7E3DA] p-6 flex flex-col gap-3">
                                <div className="flex justify-between items-start">
                                    <div className="flex flex-col gap-2">
                                        <span className="inline-flex items-center px-3 py-1 rounded-full bg-[#EBF2EB] text-[#4F6B50] font-label-caps text-[10px] tracking-wider uppercase w-max">BLOATING</span>
                                        <span className="font-body-sm text-[#5C6367]">Oct 24, 2023</span>
                                    </div>
                                    <div className="flex flex-col items-end gap-1">
                                        <span className="font-label-caps text-[10px] text-[#5C6367] uppercase tracking-wider">Severity</span>
                                        <div className="font-data-md tabular-nums text-[#5C6367]">
                                            <span className="text-[#D4AF37] font-bold">3</span> / 5
                                        </div>
                                    </div>
                                </div>
                                <div className="font-body-sm text-[#1A1C1E]">
                                    • Correlated with: <span className="font-data-md tabular-nums text-[#1A1C1E]">hp-paneer-bowl</span>
                                </div>
                                <div className="h-px w-full bg-[#E7E3DA] my-2"></div>
                                <div className="font-body-sm text-[#5C6367] italic">
                                    &quot;Observed 45m post-consumption.&quot;
                                </div>
                            </div>

                            {/* Card 2 */}
                            <div className="bg-white rounded-xl border border-[#E7E3DA] p-6 flex flex-col gap-3">
                                <div className="flex justify-between items-start">
                                    <div className="flex flex-col gap-2">
                                        <span className="inline-flex items-center px-3 py-1 rounded-full bg-[#EBF2EB] text-[#4F6B50] font-label-caps text-[10px] tracking-wider uppercase w-max">ACID REFLUX</span>
                                        <span className="font-body-sm text-[#5C6367]">Oct 22, 2023</span>
                                    </div>
                                    <div className="flex flex-col items-end gap-1">
                                        <span className="font-label-caps text-[10px] text-[#5C6367] uppercase tracking-wider">Severity</span>
                                        <div className="font-data-md tabular-nums text-[#5C6367]">
                                            <span className="text-[#D4AF37] font-bold">4</span> / 5
                                        </div>
                                    </div>
                                </div>
                                <div className="font-body-sm text-[#1A1C1E]">
                                    • Correlated with: <span className="font-data-md tabular-nums text-[#1A1C1E]">hp-paneer-bowl</span>
                                </div>
                            </div>

                            {/* Card 3 */}
                            <div className="bg-white rounded-xl border border-[#E7E3DA] p-6 flex flex-col gap-3">
                                <div className="flex justify-between items-start">
                                    <div className="flex flex-col gap-2">
                                        <span className="inline-flex items-center px-3 py-1 rounded-full bg-[#EBF2EB] text-[#4F6B50] font-label-caps text-[10px] tracking-wider uppercase w-max">LETHARGY</span>
                                        <span className="font-body-sm text-[#5C6367]">Oct 21, 2023</span>
                                    </div>
                                    <div className="flex flex-col items-end gap-1">
                                        <span className="font-label-caps text-[10px] text-[#5C6367] uppercase tracking-wider">Severity</span>
                                        <div className="font-data-md tabular-nums text-[#5C6367]">
                                            <span className="text-[#D4AF37] font-bold">2</span> / 5
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
