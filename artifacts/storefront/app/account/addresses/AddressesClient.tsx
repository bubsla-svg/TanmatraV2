"use client";

import React from 'react';
import Link from 'next/link';

export default function AddressesClient() {
    return (
        <div className="bg-[#FBFAF7] text-[#1A1C1E] antialiased min-h-screen pb-32">
            {/* Top Navigation Tabs */}
            <div className="sticky top-0 w-full z-40 bg-[#FBFAF7] border-b border-[#E7E3DA]">
                <nav className="flex overflow-x-auto hide-scrollbar px-4">
                    <ul className="flex items-center space-x-6 whitespace-nowrap h-12">
                        <li><Link className="font-body-md text-[#5C6367] hover:text-[#1A1C1E] transition-colors py-3 block" href="/account/subscriptions">Plans</Link></li>
                        <li><Link className="font-body-md text-[#5C6367] hover:text-[#1A1C1E] transition-colors py-3 block" href="/account/orders">Orders</Link></li>
                        <li><Link className="font-body-md text-[#5C6367] hover:text-[#1A1C1E] transition-colors py-3 block" href="/account/appointments">Consults</Link></li>
                        <li><Link className="font-body-md text-[#5C6367] hover:text-[#1A1C1E] transition-colors py-3 block" href="/account/billing">Billing</Link></li>
                        <li className="relative">
                            <Link className="font-body-md text-[#1A1C1E] font-semibold py-3 block" href="/account/addresses">Addresses</Link>
                            <div className="absolute bottom-0 left-0 w-full h-[2px] bg-[#d4af37]"></div>
                        </li>
                        <li><Link className="font-body-md text-[#5C6367] hover:text-[#1A1C1E] transition-colors py-3 block" href="/account/preferences">Preferences</Link></li>
                        <li><Link className="font-body-md text-[#5C6367] hover:text-[#1A1C1E] transition-colors py-3 block" href="/account/wellness">Health</Link></li>
                        <li><Link className="font-body-md text-[#5C6367] hover:text-[#1A1C1E] transition-colors py-3 block" href="/account/loyalty">Rewards</Link></li>
                        <li><Link className="font-body-md text-[#5C6367] hover:text-[#1A1C1E] transition-colors py-3 block" href="/account/symptoms">Symptoms</Link></li>
                        <li><Link className="font-body-md text-[#5C6367] hover:text-[#1A1C1E] transition-colors py-3 block" href="/account/history">History</Link></li>
                    </ul>
                </nav>
            </div>

            {/* Main Content Canvas */}
            <main className="w-full max-w-3xl mx-auto px-4 pt-6 pb-32">
                <h2 className="font-headline-md md:text-3xl mb-6 font-bold text-[#1A1C1E]">Manage Addresses</h2>
                <div className="flex flex-col gap-3 mb-6">
                    {/* Address Card 1 (Default) */}
                    <div className="bg-white border border-[#E7E3DA] rounded-2xl p-5">
                        <div className="flex items-center gap-2 mb-2">
                            <span className="font-bold text-[#1A1C1E]">Home</span>
                            <span className="text-xs border border-[#E7E3DA] px-2 py-0.5 rounded-full text-[#5C6367] lowercase">home</span>
                            <span className="text-xs bg-[#EBF2EB] text-[#4F6B50] px-2 py-0.5 rounded-full font-medium ml-2">Default</span>
                        </div>
                        <div className="text-[#5C6367] mb-2">
                            42, Residency Road, Shanti Nagar, Bengaluru, KA 560025
                        </div>
                        <div className="font-data-sm text-[#5C6367] mb-4 opacity-70 tabular-nums">
                            +91 90000 00000
                        </div>
                        <div className="flex items-center gap-6 text-sm font-medium">
                            <button className="text-[#d4af37] hover:opacity-80 transition-opacity">Edit</button>
                            <button className="text-[#C2603F] hover:opacity-80 transition-opacity">Delete</button>
                        </div>
                    </div>

                    {/* Address Card 2 */}
                    <div className="bg-white border border-[#E7E3DA] rounded-2xl p-5">
                        <div className="flex items-center gap-2 mb-2">
                            <span className="font-bold text-[#1A1C1E]">Work</span>
                            <span className="text-xs border border-[#E7E3DA] px-2 py-0.5 rounded-full text-[#5C6367] lowercase">office</span>
                        </div>
                        <div className="text-[#5C6367] mb-2">
                            14, Innovation Park, Electronic City Phase 1, Bengaluru, KA 560100
                        </div>
                        <div className="font-data-sm text-[#5C6367] mb-4 opacity-70 tabular-nums">
                            +91 98888 77777
                        </div>
                        <div className="flex items-center gap-6 text-sm font-medium">
                            <button className="text-[#d4af37] hover:opacity-80 transition-opacity">Edit</button>
                            <button className="text-[#5C6367] hover:opacity-80 transition-opacity">Set default</button>
                            <button className="text-[#C2603F] hover:opacity-80 transition-opacity">Delete</button>
                        </div>
                    </div>
                </div>

                {/* Add Address CTA */}
                <button className="bg-[#d4af37] text-white font-bold py-3 px-6 rounded-full w-full sm:w-auto hover:opacity-90 transition-opacity text-left inline-block">
                    Add an address
                </button>
            </main>
        </div>
    );
}
