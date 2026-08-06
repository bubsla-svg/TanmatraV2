"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';

export default function FavoritesClient() {
    const [quantities, setQuantities] = useState<{ keto: number; ragu: number; salmon: number }>({
        keto: 1,
        ragu: 2,
        salmon: 1
    });

    const [mounted, setMounted] = useState(false);
    useEffect(() => {
        setMounted(true);
    }, []);

    const handleIncrement = (id: 'keto' | 'ragu' | 'salmon') => {
        setQuantities(prev => ({ ...prev, [id]: prev[id] + 1 }));
    };

    const handleDecrement = (id: 'keto' | 'ragu' | 'salmon') => {
        setQuantities(prev => ({ ...prev, [id]: Math.max(1, prev[id] - 1) }));
    };

    const totalQuantity = quantities.keto + quantities.ragu + quantities.salmon;
    const totalPrice = (quantities.keto * 24.50) + (quantities.ragu * 32.00) + (quantities.salmon * 28.90);

    return (
        <div className="bg-neutral-950 text-stone-200 min-h-screen pb-32">
            <main className="max-w-5xl mx-auto px-4 py-12">
                {/* Header Section */}
                <header className="mb-12 space-y-4">
                    <div className="inline-block px-3 py-1 bg-yellow-400/10 border border-yellow-400/20 rounded-full">
                        <span className="font-label-caps text-yellow-400 uppercase tracking-wider text-xs">Personal Clinical Repository</span>
                    </div>
                    <h1 className="font-headline-lg text-3xl md:text-5xl font-semibold tracking-tight text-stone-200">
                        My Protocol Vault
                    </h1>
                    <p className="font-body-lg text-neutral-400 max-w-2xl leading-relaxed">
                        Your secure library of metabolism-optimizing culinary prescriptions. Revisit your high-performance favorites or re-queue them for your next clinical cycle.
                    </p>
                </header>

                {/* Favorites Grid */}
                <section className="grid grid-cols-1 gap-8">

                    {/* Card 1: Keto-Cleanse Bowl */}
                    <article className={`bg-neutral-900 border border-white/10 rounded-2xl overflow-hidden transition-all duration-700 hover:shadow-2xl hover:shadow-black/40 group ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
                        {/* Top Action Row */}
                        <div className="flex justify-between items-center p-4">
                            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-400/10 border border-green-400/20 text-green-400 font-label-caps text-[10px] tracking-wider uppercase">
                                <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'wght' 700" }}>check_circle</span>
                                Vault Saved
                            </span>
                            <button className="text-neutral-400 hover:text-red-600 transition-colors font-label-caps text-[10px] tracking-wider uppercase flex items-center gap-1">
                                Remove <span className="material-symbols-outlined text-sm">close</span>
                            </button>
                        </div>
                        {/* Image Block */}
                        <div className="px-4">
                            <div className="relative aspect-video rounded-xl overflow-hidden">
                                <img alt="Keto-Cleanse bowl" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" src="https://lh3.googleusercontent.com/aida-public/AB6AXuCK1MiBe2AR6-Z-52nEj3TeL7rLlK6N2REq6O6yOgu_j2DQF4pfyJNM7ZG1obD_IvaFmcRrTyny4CIQz6-l4kYpW6Pb-nUQfkSU42KhHYjZ9yArOA5jnypJTysXey-2LZcHpAXEK4zsO9mzsoi4jdywBEhLSSCtJCAIaWYcfxb4p5iG6TgTzhMsA4UOaVUR4fZx0xBHVLxMY9TJ0ch80aJDX-AL0aUBN5s9z84bKMSDgEmgARQG3h1gPIXT09PSdH7hTJecp2WwfMw" />
                            </div>
                        </div>
                        {/* Content Area */}
                        <div className="p-6 space-y-4">
                            <div className="flex justify-between items-start">
                                <Link className="block group/link" href="/dish/keto-cleanse-bowl">
                                    <h2 className="font-headline-md text-2xl text-stone-200 group-hover/link:text-yellow-400 transition-colors">Keto-Cleanse Bowl</h2>
                                </Link>
                                <span className="font-clinical-data text-yellow-400">$24.50</span>
                            </div>
                            <div className="bg-neutral-800 p-3 rounded-xl border border-white/10">
                                <p className="font-body-sm text-neutral-400 italic leading-snug">
                                    Note: Optimized for morning cortisol stabilization. High-bioavailability fats paired with fiber-rich cruciferous base.
                                </p>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                <span className="bg-neutral-800 px-3 py-1 rounded-full font-clinical-data text-[11px] text-amber-100 uppercase">32P · 12C · 41F</span>
                                <span className="bg-neutral-800 px-3 py-1 rounded-full font-clinical-data text-[11px] text-amber-100 uppercase">Anti-Inflammatory</span>
                                <span className="bg-neutral-800 px-3 py-1 rounded-full font-clinical-data text-[11px] text-amber-100 uppercase">Gluten-Free</span>
                            </div>
                            <div className="h-px bg-white/10 w-full"></div>
                            <div className="flex items-center justify-between gap-4">
                                <div className="flex items-center bg-neutral-800 rounded-full p-1 border border-white/10">
                                    <button onClick={() => handleDecrement('keto')} className="w-10 h-10 flex items-center justify-center rounded-full text-stone-200 hover:bg-neutral-800 transition-colors active:scale-95">
                                        <span className="material-symbols-outlined text-lg">remove</span>
                                    </button>
                                    <span className="font-clinical-data text-stone-200 px-4 text-lg">{quantities.keto}</span>
                                    <button onClick={() => handleIncrement('keto')} className="w-10 h-10 flex items-center justify-center rounded-full text-stone-200 hover:bg-neutral-800 transition-colors active:scale-95">
                                        <span className="material-symbols-outlined text-lg">add</span>
                                    </button>
                                </div>
                                <button className="flex-1 bg-yellow-400 text-slate-900 font-label-caps text-sm py-4 rounded-full font-bold shadow-lg shadow-yellow-400/20 hover:opacity-90 active:scale-[0.98] transition-all uppercase tracking-widest">
                                    Add to Cart
                                </button>
                            </div>
                        </div>
                    </article>

                    {/* Card 2: Grass-fed Beef Ragù */}
                    <article className={`bg-neutral-900 border border-white/10 rounded-2xl overflow-hidden transition-all duration-700 delay-100 hover:shadow-2xl hover:shadow-black/40 group ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
                        {/* Top Action Row */}
                        <div className="flex justify-between items-center p-4">
                            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-400/10 border border-green-400/20 text-green-400 font-label-caps text-[10px] tracking-wider uppercase">
                                <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'wght' 700" }}>check_circle</span>
                                Vault Saved
                            </span>
                            <button className="text-neutral-400 hover:text-red-600 transition-colors font-label-caps text-[10px] tracking-wider uppercase flex items-center gap-1">
                                Remove <span className="material-symbols-outlined text-sm">close</span>
                            </button>
                        </div>
                        {/* Image Block */}
                        <div className="px-4">
                            <div className="relative aspect-video rounded-xl overflow-hidden">
                                <img alt="Grass-fed Beef Ragù" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" src="https://lh3.googleusercontent.com/aida-public/AB6AXuCRqnTAw8s6OrkqGcQgUoyJK99IZePyhSBPfR9H3wkAHpvkeFRx0RjF3rCB6lLiz85VXLK-be2YS2VEw482cz00i0CsS7Zyd-gJmx4G6bIQn0I9ht45CB0qKZf5jsgT3qp5znTwfAyBdhiAEu0VhFGUj5w1qnSktk_MEk9QwzOCALOqBfJ8Fikn_eKkb-G5Pku-iHfnNSEuwbRKKG5frKChokOapUIDKche5G6mpQ16-5uBS0c6cvzXsLzQtdXIKxcysL_IzGbFWX8" />
                            </div>
                        </div>
                        {/* Content Area */}
                        <div className="p-6 space-y-4">
                            <div className="flex justify-between items-start">
                                <Link className="block group/link" href="/dish/grass-fed-beef-ragu">
                                    <h2 className="font-headline-md text-2xl text-stone-200 group-hover/link:text-yellow-400 transition-colors">Grass-fed Beef Ragù</h2>
                                </Link>
                                <span className="font-clinical-data text-yellow-400">$32.00</span>
                            </div>
                            <div className="bg-neutral-800 p-3 rounded-xl border border-white/10">
                                <p className="font-body-sm text-neutral-400 italic leading-snug">
                                    Prescribed for: Post-strength training recovery. High amino-acid density with insulin-neutral vegetable noodles.
                                </p>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                <span className="bg-neutral-800 px-3 py-1 rounded-full font-clinical-data text-[11px] text-amber-100 uppercase">48P · 08C · 22F</span>
                                <span className="bg-neutral-800 px-3 py-1 rounded-full font-clinical-data text-[11px] text-amber-100 uppercase">Muscle Recovery</span>
                                <span className="bg-neutral-800 px-3 py-1 rounded-full font-clinical-data text-[11px] text-amber-100 uppercase">Low Glycemic</span>
                            </div>
                            <div className="h-px bg-white/10 w-full"></div>
                            <div className="flex items-center justify-between gap-4">
                                <div className="flex items-center bg-neutral-800 rounded-full p-1 border border-white/10">
                                    <button onClick={() => handleDecrement('ragu')} className="w-10 h-10 flex items-center justify-center rounded-full text-stone-200 hover:bg-neutral-800 transition-colors active:scale-95">
                                        <span className="material-symbols-outlined text-lg">remove</span>
                                    </button>
                                    <span className="font-clinical-data text-stone-200 px-4 text-lg">{quantities.ragu}</span>
                                    <button onClick={() => handleIncrement('ragu')} className="w-10 h-10 flex items-center justify-center rounded-full text-stone-200 hover:bg-neutral-800 transition-colors active:scale-95">
                                        <span className="material-symbols-outlined text-lg">add</span>
                                    </button>
                                </div>
                                <button className="flex-1 bg-yellow-400 text-slate-900 font-label-caps text-sm py-4 rounded-full font-bold shadow-lg shadow-yellow-400/20 hover:opacity-90 active:scale-[0.98] transition-all uppercase tracking-widest">
                                    Add to Cart
                                </button>
                            </div>
                        </div>
                    </article>

                    {/* Card 3: Seared Salmon & Asparagus */}
                    <article className={`bg-neutral-900 border border-white/10 rounded-2xl overflow-hidden transition-all duration-700 delay-200 hover:shadow-2xl hover:shadow-black/40 group ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
                        {/* Top Action Row */}
                        <div className="flex justify-between items-center p-4">
                            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-400/10 border border-green-400/20 text-green-400 font-label-caps text-[10px] tracking-wider uppercase">
                                <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'wght' 700" }}>check_circle</span>
                                Vault Saved
                            </span>
                            <button className="text-neutral-400 hover:text-red-600 transition-colors font-label-caps text-[10px] tracking-wider uppercase flex items-center gap-1">
                                Remove <span className="material-symbols-outlined text-sm">close</span>
                            </button>
                        </div>
                        {/* Image Block */}
                        <div className="px-4">
                            <div className="relative aspect-video rounded-xl overflow-hidden">
                                <img alt="Seared Salmon" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" src="https://lh3.googleusercontent.com/aida-public/AB6AXuB7FBLWcA3b3XuN8zdXUIddzBuEcNytML6EJdBHqYVNl-Z9N0lBi2aMLXnSoSLqZbUryXcdTYnumy9OG_L88uZO6ZCF_SZOy8ffmMQwc5O0i7Tvjf5YlS7gmlWScMANiC9iayZ-sIgLQneabRILidhSBzeZ9yNGKnU2u6TcqWC13FrFBdbjDlYPnSSSIDqlRSAvczReUjOLDrYTW7RvaSC_r7GnL-Owstj-Z8urVb6oBJ_ffzkGXHymPiE3s5RcnVxVlQvxVyXEboo" />
                            </div>
                        </div>
                        {/* Content Area */}
                        <div className="p-6 space-y-4">
                            <div className="flex justify-between items-start">
                                <Link className="block group/link" href="/dish/salmon-protocol">
                                    <h2 className="font-headline-md text-2xl text-stone-200 group-hover/link:text-yellow-400 transition-colors">Seared Salmon Protocol</h2>
                                </Link>
                                <span className="font-clinical-data text-yellow-400">$28.90</span>
                            </div>
                            <div className="bg-neutral-800 p-3 rounded-xl border border-white/10">
                                <p className="font-body-sm text-neutral-400 italic leading-snug">
                                    Omega-3 loading protocol. Designed to modulate systemic inflammation through high EPA/DHA intake.
                                </p>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                <span className="bg-neutral-800 px-3 py-1 rounded-full font-clinical-data text-[11px] text-amber-100 uppercase">36P · 05C · 34F</span>
                                <span className="bg-neutral-800 px-3 py-1 rounded-full font-clinical-data text-[11px] text-amber-100 uppercase">Brain Health</span>
                                <span className="bg-neutral-800 px-3 py-1 rounded-full font-clinical-data text-[11px] text-amber-100 uppercase">Paleo</span>
                            </div>
                            <div className="h-px bg-white/10 w-full"></div>
                            <div className="flex items-center justify-between gap-4">
                                <div className="flex items-center bg-neutral-800 rounded-full p-1 border border-white/10">
                                    <button onClick={() => handleDecrement('salmon')} className="w-10 h-10 flex items-center justify-center rounded-full text-stone-200 hover:bg-neutral-800 transition-colors active:scale-95">
                                        <span className="material-symbols-outlined text-lg">remove</span>
                                    </button>
                                    <span className="font-clinical-data text-stone-200 px-4 text-lg">{quantities.salmon}</span>
                                    <button onClick={() => handleIncrement('salmon')} className="w-10 h-10 flex items-center justify-center rounded-full text-stone-200 hover:bg-neutral-800 transition-colors active:scale-95">
                                        <span className="material-symbols-outlined text-lg">add</span>
                                    </button>
                                </div>
                                <button className="flex-1 bg-yellow-400 text-slate-900 font-label-caps text-sm py-4 rounded-full font-bold shadow-lg shadow-yellow-400/20 hover:opacity-90 active:scale-[0.98] transition-all uppercase tracking-widest">
                                    Add to Cart
                                </button>
                            </div>
                        </div>
                    </article>
                </section>

                {/* Mini Cart Bar (Floating) */}
                <div className={`fixed bottom-8 md:bottom-12 left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] max-w-lg z-40 transition-transform duration-500 delay-300 ${mounted ? 'translate-y-0 opacity-100' : 'translate-y-20 opacity-0'}`}>
                    <div className="backdrop-blur-md bg-neutral-900/70 border border-white/10 shadow-2xl rounded-2xl p-4 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-yellow-400 flex items-center justify-center text-slate-900">
                                <span className="font-clinical-data font-bold">{totalQuantity}</span>
                            </div>
                            <div className="flex flex-col">
                                <span className="font-label-caps text-[10px] text-neutral-400 uppercase">Staged Protocols</span>
                                <span className="font-clinical-data text-stone-200">${totalPrice.toFixed(2)} Total</span>
                            </div>
                        </div>
                        <button className="bg-stone-200 text-neutral-950 font-label-caps text-[11px] py-2 px-6 rounded-full font-bold uppercase transition-transform active:scale-95">
                            Checkout Now
                        </button>
                    </div>
                </div>
            </main>
        </div>
    );
}
