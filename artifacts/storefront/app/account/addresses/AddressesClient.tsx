"use client";

import React from 'react';
import Link from 'next/link';

export default function AddressesClient() {
    return (
        <div className="bg-gray-50 text-gray-900 antialiased min-h-screen pb-32">
            {/* Top Navigation Tabs */}
            <div className="sticky top-0 w-full z-40 bg-gray-50 border-b border-gray-200">
                <nav className="flex overflow-x-auto hide-scrollbar px-4">
                    <ul className="flex items-center space-x-6 whitespace-nowrap h-12">
                        <li><Link className="font-body-md text-gray-500 hover:text-gray-900 transition-colors py-3 block" href="/account/subscriptions">Plans</Link></li>
                        <li><Link className="font-body-md text-gray-500 hover:text-gray-900 transition-colors py-3 block" href="/account/orders">Orders</Link></li>
                        <li><Link className="font-body-md text-gray-500 hover:text-gray-900 transition-colors py-3 block" href="/account/appointments">Consults</Link></li>
                        <li><Link className="font-body-md text-gray-500 hover:text-gray-900 transition-colors py-3 block" href="/account/billing">Billing</Link></li>
                        <li className="relative">
                            <Link className="font-body-md text-gray-900 font-semibold py-3 block" href="/account/addresses">Addresses</Link>
                            <div className="absolute bottom-0 left-0 w-full h-[2px] bg-yellow-500"></div>
                        </li>
                        <li><Link className="font-body-md text-gray-500 hover:text-gray-900 transition-colors py-3 block" href="/account/preferences">Preferences</Link></li>
                        <li><Link className="font-body-md text-gray-500 hover:text-gray-900 transition-colors py-3 block" href="/account/wellness">Health</Link></li>
                        <li><Link className="font-body-md text-gray-500 hover:text-gray-900 transition-colors py-3 block" href="/account/loyalty">Rewards</Link></li>
                        <li><Link className="font-body-md text-gray-500 hover:text-gray-900 transition-colors py-3 block" href="/account/symptoms">Symptoms</Link></li>
                        <li><Link className="font-body-md text-gray-500 hover:text-gray-900 transition-colors py-3 block" href="/account/history">History</Link></li>
                    </ul>
                </nav>
            </div>

            {/* Main Content Canvas */}
            <main className="w-full max-w-3xl mx-auto px-4 pt-6 pb-32">
                <h2 className="font-headline-md md:text-3xl mb-6 font-bold text-gray-900">Manage Addresses</h2>
                <div className="flex flex-col gap-3 mb-6">
                    {/* Address Card 1 (Default) */}
                    <div className="bg-white border border-gray-200 rounded-2xl p-5">
                        <div className="flex items-center gap-2 mb-2">
                            <span className="font-bold text-gray-900">Home</span>
                            <span className="text-xs border border-gray-200 px-2 py-0.5 rounded-full text-gray-500 lowercase">home</span>
                            <span className="text-xs bg-green-50 text-green-800 px-2 py-0.5 rounded-full font-medium ml-2">Default</span>
                        </div>
                        <div className="text-gray-500 mb-2">
                            42, Residency Road, Shanti Nagar, Bengaluru, KA 560025
                        </div>
                        <div className="font-data-sm text-gray-500 mb-4 opacity-70 tabular-nums">
                            +91 90000 00000
                        </div>
                        <div className="flex items-center gap-6 text-sm font-medium">
                            <button className="text-yellow-500 hover:opacity-80 transition-opacity">Edit</button>
                            <button className="text-orange-500 hover:opacity-80 transition-opacity">Delete</button>
                        </div>
                    </div>

                    {/* Address Card 2 */}
                    <div className="bg-white border border-gray-200 rounded-2xl p-5">
                        <div className="flex items-center gap-2 mb-2">
                            <span className="font-bold text-gray-900">Work</span>
                            <span className="text-xs border border-gray-200 px-2 py-0.5 rounded-full text-gray-500 lowercase">office</span>
                        </div>
                        <div className="text-gray-500 mb-2">
                            14, Innovation Park, Electronic City Phase 1, Bengaluru, KA 560100
                        </div>
                        <div className="font-data-sm text-gray-500 mb-4 opacity-70 tabular-nums">
                            +91 98888 77777
                        </div>
                        <div className="flex items-center gap-6 text-sm font-medium">
                            <button className="text-yellow-500 hover:opacity-80 transition-opacity">Edit</button>
                            <button className="text-gray-500 hover:opacity-80 transition-opacity">Set default</button>
                            <button className="text-orange-500 hover:opacity-80 transition-opacity">Delete</button>
                        </div>
                    </div>
                </div>

                {/* Add Address CTA */}
                <button className="bg-yellow-500 text-white font-bold py-3 px-6 rounded-full w-full sm:w-auto hover:opacity-90 transition-opacity text-left inline-block">
                    Add an address
                </button>
            </main>
        </div>
    );
}
