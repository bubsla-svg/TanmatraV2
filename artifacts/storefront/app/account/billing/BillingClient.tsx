"use client";

import React from 'react';
import Link from 'next/link';
import { formatPaise } from '@/lib/format';

export default function BillingClient() {
    return (
        <div className="bg-gray-50 text-gray-900 antialiased min-h-screen pb-32">
            {/* Top Navigation Tabs */}
            <div className="sticky top-0 z-10 bg-gray-50 border-b border-gray-200">
                <nav className="flex overflow-x-auto hide-scrollbar px-4">
                    <ul className="flex items-center space-x-6 whitespace-nowrap h-12">
                        <li><Link className="font-body-md text-gray-500 hover:text-gray-900 transition-colors py-3 block" href="/account/subscriptions">Plans</Link></li>
                        <li><Link className="font-body-md text-gray-500 hover:text-gray-900 transition-colors py-3 block" href="/account/orders">Orders</Link></li>
                        <li><Link className="font-body-md text-gray-500 hover:text-gray-900 transition-colors py-3 block" href="/account/appointments">Consults</Link></li>
                        <li className="relative">
                            <Link className="font-body-md text-gray-900 font-semibold py-3 block" href="/account/billing">Billing</Link>
                            <div className="absolute bottom-0 left-0 w-full h-[2px] bg-yellow-500"></div>
                        </li>
                        <li><Link className="font-body-md text-gray-500 hover:text-gray-900 transition-colors py-3 block" href="/account/addresses">Addresses</Link></li>
                        <li><Link className="font-body-md text-gray-500 hover:text-gray-900 transition-colors py-3 block" href="/account/preferences">Preferences</Link></li>
                        <li><Link className="font-body-md text-gray-500 hover:text-gray-900 transition-colors py-3 block" href="/account/wellness">Health</Link></li>
                        <li><Link className="font-body-md text-gray-500 hover:text-gray-900 transition-colors py-3 block" href="/account/loyalty">Rewards</Link></li>
                        <li><Link className="font-body-md text-gray-500 hover:text-gray-900 transition-colors py-3 block" href="/account/symptoms">Symptoms</Link></li>
                        <li><Link className="font-body-md text-gray-500 hover:text-gray-900 transition-colors py-3 block" href="/account/history">History</Link></li>
                    </ul>
                </nav>
            </div>

            {/* Main Content Canvas */}
            <main className="max-w-[800px] mx-auto px-4 md:px-6 pt-10 md:pt-16">

                {/* Hero Wallet Card */}
                <section className="mb-10">
                    <div className="bg-white rounded-xl border border-gray-200 p-6 md:p-10 text-center flex flex-col items-center justify-center min-h-[240px]">
                        <h2 className="font-label-caps text-gray-500 tracking-widest mb-4">WALLET BALANCE</h2>
                        <div className="font-display text-5xl md:text-6xl text-yellow-500 tabular-nums mb-6">{formatPaise(34000)}</div>
                        <p className="font-body-md text-gray-500 max-w-md mx-auto">
                            Applied automatically at checkout. Use the <Link href="/account/billing" className="text-yellow-500 hover:underline underline-offset-4">wallet page</Link> to redeem a voucher.
                        </p>
                    </div>
                </section>

                {/* Credit Activity Section */}
                <section className="mb-16">
                    <h3 className="font-headline-md text-gray-900 mb-6">Credit activity</h3>
                    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">

                        {/* Row 1 */}
                        <div className="flex items-center justify-between p-4 md:p-6 border-b border-gray-200 last:border-b-0 hover:bg-gray-50 transition-colors">
                            <div>
                                <div className="font-body-md text-gray-900 font-medium">Referral bonus</div>
                                <div className="font-label-caps text-gray-500 mt-1">Oct 24, 2023</div>
                            </div>
                            <div className="font-data-md text-green-400 tabular-nums">+{formatPaise(5000)}</div>
                        </div>

                        {/* Row 2 */}
                        <div className="flex items-center justify-between p-4 md:p-6 border-b border-gray-200 last:border-b-0 hover:bg-gray-50 transition-colors">
                            <div>
                                <div className="font-body-md text-gray-900 font-medium">Plan adjustment credit</div>
                                <div className="font-label-caps text-gray-500 mt-1">Oct 20, 2023</div>
                            </div>
                            <div className="font-data-md text-green-400 tabular-nums">+{formatPaise(5000)}</div>
                        </div>

                        {/* Row 3 */}
                        <div className="flex items-center justify-between p-4 md:p-6 border-b border-gray-200 last:border-b-0 hover:bg-gray-50 transition-colors">
                            <div>
                                <div className="font-body-md text-gray-900 font-medium">Standard meal purchase</div>
                                <div className="font-label-caps text-gray-500 mt-1">Oct 18, 2023</div>
                            </div>
                            <div className="font-data-md text-gray-500 tabular-nums">−{formatPaise(2000)}</div>
                        </div>

                        {/* Row 4 */}
                        <div className="flex items-center justify-between p-4 md:p-6 border-b border-gray-200 last:border-b-0 hover:bg-gray-50 transition-colors">
                            <div>
                                <div className="font-body-md text-gray-900 font-medium">Beta tester reward</div>
                                <div className="font-label-caps text-gray-500 mt-1">Oct 15, 2023</div>
                            </div>
                            <div className="font-data-md text-green-400 tabular-nums">+{formatPaise(5000)}</div>
                        </div>

                    </div>
                </section>

                {/* Footnote */}
                <footer className="text-center">
                    <p className="font-label-caps text-gray-400">
                        Looking for receipts or plan billing? Visit <Link className="text-yellow-500 hover:underline underline-offset-2" href="/account/orders">orders</Link> or <Link className="text-yellow-500 hover:underline underline-offset-2" href="/account/subscriptions">plans</Link>.
                    </p>
                </footer>
            </main>
        </div>
    );
}
