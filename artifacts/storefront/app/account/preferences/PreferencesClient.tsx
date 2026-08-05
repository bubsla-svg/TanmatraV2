"use client";

import React, { useState } from 'react';
import Link from 'next/link';

export default function PreferencesClient() {
    const [allergens, setAllergens] = useState(['Shellfish', 'Dairy']);
    const [disliked, setDisliked] = useState(['Coriander', 'Eggplant']);
    const [cuisines, setCuisines] = useState(['Mediterranean', 'Japanese']);

    const removeAllergen = (item: string) => setAllergens(allergens.filter(a => a !== item));
    const removeDisliked = (item: string) => setDisliked(disliked.filter(a => a !== item));
    const removeCuisine = (item: string) => setCuisines(cuisines.filter(a => a !== item));

    return (
        <div className="min-h-screen bg-canvas text-body-sm selection:bg-primary/30">
            {/* Top Navigation Shell Placeholder */}
            <header className="fixed top-0 w-full z-50 backdrop-blur-md bg-glass border-b border-hairline flex items-center justify-between px-gutter h-16">
                <div className="font-headline-md text-headline-md font-bold tracking-tight text-primary">METABOLIC OS</div>
                <div className="flex gap-4">
                    <span className="material-symbols-outlined text-primary" style={{ fontVariationSettings: "'wght' 300" }}>shopping_bag</span>
                </div>
            </header>

            <main className="pt-16 pb-32 max-w-screen-md mx-auto px-gutter min-h-screen relative">
                {/* Hero Decoration */}
                <div className="absolute top-0 right-0 -z-10 opacity-20 pointer-events-none w-full h-[400px] overflow-hidden">
                    <img className="w-full h-full object-cover" src="https://lh3.googleusercontent.com/aida-public/AB6AXuDCGdfyiM2bc3MOLc3I4q3LXk0FEHJJ3rkmVFzsZbAVXPZyjOQQJ50CQTfzRvaLrH7DrY_4tVaKwwiWLgbWDjb0WEDTb3GiHxZTF0coy4JT2OpcFo2ln8EjKAJ4eedNJVPTlOubfAz36QjkDK5rtJcmj4HK3x0v7qIwwVi2SpNCtw6SlVurL1IW8VI6XMPTe6pQt3i-FJWH1PzK3_ZXDsdUQklnTRox1k2EcPvGumyTScv7y87ov36kjcTowrfkShCG7hixLTYFGl8" alt="Clinical metabolic meal" />
                </div>

                {/* Account Navigation */}
                <nav className="mt-8 flex overflow-x-auto hide-scrollbar border-b border-hairline sticky top-16 bg-canvas z-40">
                    <div className="flex gap-8 px-1">
                        <Link href="/account" className="py-4 font-label-caps text-label-caps text-ink-secondary whitespace-nowrap active:scale-[0.98] transition-transform">General</Link>
                        <Link href="/account/wellness" className="py-4 font-label-caps text-label-caps text-ink-secondary whitespace-nowrap active:scale-[0.98] transition-transform">Health</Link>
                        <Link href="#" className="py-4 font-label-caps text-label-caps text-ink-secondary whitespace-nowrap active:scale-[0.98] transition-transform">Bio-Markers</Link>
                        <Link href="/account/preferences" className="py-4 font-label-caps text-label-caps text-primary border-b-2 border-primary whitespace-nowrap active:scale-[0.98] transition-transform">Preferences</Link>
                        <Link href="/account/billing" className="py-4 font-label-caps text-label-caps text-ink-secondary whitespace-nowrap active:scale-[0.98] transition-transform">Billing</Link>
                    </div>
                </nav>

                {/* Page Title Section */}
                <section className="mt-10 animate-[fadeIn_0.6s_cubic-bezier(0.16,1,0.3,1)_forwards]" style={{ animationDelay: '0.1s' }}>
                    <h1 className="font-headline-lg-mobile text-headline-lg-mobile text-ink-primary">Preferences</h1>
                    <p className="mt-2 text-ink-secondary font-body-sm opacity-80">Tailor your metabolic protocols and culinary ranking.</p>
                </section>

                {/* Preferences Form */}
                <form className="mt-12 space-y-10 animate-[fadeIn_0.6s_cubic-bezier(0.16,1,0.3,1)_forwards]" style={{ animationDelay: '0.2s' }}>
                    {/* Select Fields Group */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Dietary Style */}
                        <div className="bg-white/[0.03] backdrop-blur-md border border-white/5 rounded-3xl p-6 relative group transition-all hover:bg-white/[0.05]">
                            <label className="block font-label-caps text-label-caps text-primary mb-3">Dietary Style</label>
                            <select className="w-full bg-transparent border-none p-0 font-body-lg text-body-lg text-ink-primary focus:ring-0 cursor-pointer appearance-none" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\\\'http://www.w3.org/2000/svg\\\' fill=\\\'none\\\' viewBox=\\\'0 0 24 24\\\' stroke=\\\'%23D4AF37\\\'%3E%3Cpath stroke-linecap=\\\'round\\\' stroke-linejoin=\\\'round\\\' stroke-width=\\\'2\\\' d=\\\'M19 9l-7 7-7-7\\\'%3E%3C/path%3E%3C/svg%3E")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 1rem center', backgroundSize: '1.25em' }}>
                                <option className="bg-surface-container">Omnivore</option>
                                <option className="bg-surface-container">Vegan</option>
                                <option className="bg-surface-container">Keto</option>
                                <option className="bg-surface-container">Pescatarian</option>
                            </select>
                        </div>

                        {/* Goal */}
                        <div className="bg-white/[0.03] backdrop-blur-md border border-white/5 rounded-3xl p-6 group transition-all hover:bg-white/[0.05]">
                            <label className="block font-label-caps text-label-caps text-primary mb-3">Primary Goal</label>
                            <select className="w-full bg-transparent border-none p-0 font-body-lg text-body-lg text-ink-primary focus:ring-0 cursor-pointer appearance-none" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\\\'http://www.w3.org/2000/svg\\\' fill=\\\'none\\\' viewBox=\\\'0 0 24 24\\\' stroke=\\\'%23D4AF37\\\'%3E%3Cpath stroke-linecap=\\\'round\\\' stroke-linejoin=\\\'round\\\' stroke-width=\\\'2\\\' d=\\\'M19 9l-7 7-7-7\\\'%3E%3C/path%3E%3C/svg%3E")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 1rem center', backgroundSize: '1.25em' }}>
                                <option className="bg-surface-container">General Wellness</option>
                                <option className="bg-surface-container">Weight Management</option>
                                <option className="bg-surface-container">Muscle Synthesis</option>
                                <option className="bg-surface-container">Longevity</option>
                            </select>
                        </div>

                        {/* Activity Level */}
                        <div className="bg-white/[0.03] backdrop-blur-md border border-white/5 rounded-3xl p-6 group transition-all hover:bg-white/[0.05]">
                            <label className="block font-label-caps text-label-caps text-primary mb-3">Activity Level</label>
                            <select defaultValue="Level 3: Moderate" className="w-full bg-transparent border-none p-0 font-body-lg text-body-lg text-ink-primary focus:ring-0 cursor-pointer font-clinical-data appearance-none" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\\\'http://www.w3.org/2000/svg\\\' fill=\\\'none\\\' viewBox=\\\'0 0 24 24\\\' stroke=\\\'%23D4AF37\\\'%3E%3Cpath stroke-linecap=\\\'round\\\' stroke-linejoin=\\\'round\\\' stroke-width=\\\'2\\\' d=\\\'M19 9l-7 7-7-7\\\'%3E%3C/path%3E%3C/svg%3E")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 1rem center', backgroundSize: '1.25em' }}>
                                <option className="bg-surface-container">Level 1: Sedentary</option>
                                <option className="bg-surface-container">Level 2: Light</option>
                                <option className="bg-surface-container">Level 3: Moderate</option>
                                <option className="bg-surface-container">Level 4: High</option>
                            </select>
                        </div>

                        {/* Spice Level */}
                        <div className="bg-white/[0.03] backdrop-blur-md border border-white/5 rounded-3xl p-6 group transition-all hover:bg-white/[0.05]">
                            <label className="block font-label-caps text-label-caps text-primary mb-3">Spice Tolerance</label>
                            <select className="w-full bg-transparent border-none p-0 font-body-lg text-body-lg text-ink-primary focus:ring-0 cursor-pointer appearance-none" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\\\'http://www.w3.org/2000/svg\\\' fill=\\\'none\\\' viewBox=\\\'0 0 24 24\\\' stroke=\\\'%23D4AF37\\\'%3E%3Cpath stroke-linecap=\\\'round\\\' stroke-linejoin=\\\'round\\\' stroke-width=\\\'2\\\' d=\\\'M19 9l-7 7-7-7\\\'%3E%3C/path%3E%3C/svg%3E")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 1rem center', backgroundSize: '1.25em' }}>
                                <option className="bg-surface-container">Mild</option>
                                <option className="bg-surface-container">Medium</option>
                                <option className="bg-surface-container">High</option>
                                <option className="bg-surface-container">Clinical Fire</option>
                            </select>
                        </div>
                    </div>

                    {/* Tag Editors Section */}
                    <div className="space-y-6">
                        {/* Allergens */}
                        <div className="bg-white/[0.03] backdrop-blur-md border border-white/5 rounded-3xl p-6">
                            <div className="flex justify-between items-center mb-4">
                                <label className="font-label-caps text-label-caps text-primary">Allergens</label>
                                <button className="text-ink-secondary hover:text-primary transition-colors" type="button">
                                    <span className="material-symbols-outlined" style={{ fontVariationSettings: "'wght' 300" }}>add_circle</span>
                                </button>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {allergens.map(a => (
                                    <div key={a} className="bg-sage-signal/10 border border-sage-signal/20 rounded-full px-4 py-2 flex items-center gap-2 group animate-[fadeIn_0.6s_cubic-bezier(0.16,1,0.3,1)_forwards]">
                                        <span className="text-sage-signal font-label-caps text-[11px] uppercase tracking-wider">{a}</span>
                                        <button onClick={() => removeAllergen(a)} className="hover:text-white transition-colors" type="button">
                                            <span className="material-symbols-outlined text-[14px]" style={{ fontVariationSettings: "'wght' 300" }}>close</span>
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Disliked Ingredients */}
                        <div className="bg-white/[0.03] backdrop-blur-md border border-white/5 rounded-3xl p-6">
                            <div className="flex justify-between items-center mb-4">
                                <label className="font-label-caps text-label-caps text-primary">Disliked Ingredients</label>
                                <button className="text-ink-secondary hover:text-primary transition-colors" type="button">
                                    <span className="material-symbols-outlined" style={{ fontVariationSettings: "'wght' 300" }}>add_circle</span>
                                </button>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {disliked.map(d => (
                                    <div key={d} className="bg-white/5 border border-white/10 rounded-full px-4 py-2 flex items-center gap-2 group">
                                        <span className="text-ink-primary font-label-caps text-[11px] uppercase tracking-wider">{d}</span>
                                        <button onClick={() => removeDisliked(d)} className="text-ink-secondary hover:text-white transition-colors" type="button">
                                            <span className="material-symbols-outlined text-[14px]" style={{ fontVariationSettings: "'wght' 300" }}>close</span>
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Preferred Cuisines */}
                        <div className="bg-white/[0.03] backdrop-blur-md border border-white/5 rounded-3xl p-6">
                            <div className="flex justify-between items-center mb-4">
                                <label className="font-label-caps text-label-caps text-primary">Preferred Cuisines</label>
                                <button className="text-ink-secondary hover:text-primary transition-colors" type="button">
                                    <span className="material-symbols-outlined" style={{ fontVariationSettings: "'wght' 300" }}>add_circle</span>
                                </button>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {cuisines.map(c => (
                                    <div key={c} className="bg-white/5 border border-white/10 rounded-full px-4 py-2 flex items-center gap-2 group">
                                        <span className="text-ink-primary font-label-caps text-[11px] uppercase tracking-wider">{c}</span>
                                        <button onClick={() => removeCuisine(c)} className="text-ink-secondary hover:text-white transition-colors" type="button">
                                            <span className="material-symbols-outlined text-[14px]" style={{ fontVariationSettings: "'wght' 300" }}>close</span>
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Form Action */}
                    <div className="pt-6">
                        <button className="w-full bg-primary-container text-ink-on-gold font-label-caps text-label-caps py-5 rounded-full transition-all active:scale-[0.98] shadow-lg shadow-primary/10 hover:brightness-110" type="submit">
                            SAVE PREFERENCES
                        </button>
                    </div>

                    {/* Clinical Disclaimer */}
                    <div className="text-center opacity-40 font-clinical-data text-[10px] tracking-widest uppercase pb-12">
                        Protocol Version: 4.2.1-OS | Secure Clinical Data Node
                    </div>
                </form>
            </main>

            {/* Bottom Nav */}
            <nav className="fixed bottom-0 w-full z-50 backdrop-blur-md bg-glass border-t border-hairline pb-safe">
                <div className="flex justify-around items-center h-16 w-full px-4">
                    <Link href="/account" className="flex flex-col items-center justify-center text-ink-secondary transition-all active:scale-[0.98]">
                        <span className="material-symbols-outlined" style={{ fontVariationSettings: "'wght' 300" }}>analytics</span>
                        <span className="font-label-caps text-[10px] mt-1">Dashboard</span>
                    </Link>
                    <Link href="/meal-planner" className="flex flex-col items-center justify-center text-ink-secondary transition-all active:scale-[0.98]">
                        <span className="material-symbols-outlined" style={{ fontVariationSettings: "'wght' 300" }}>restaurant_menu</span>
                        <span className="font-label-caps text-[10px] mt-1">Menu</span>
                    </Link>
                    <Link href="/account/subscriptions" className="flex flex-col items-center justify-center text-ink-secondary transition-all active:scale-[0.98]">
                        <span className="material-symbols-outlined" style={{ fontVariationSettings: "'wght' 300" }}>assignment_turned_in</span>
                        <span className="font-label-caps text-[10px] mt-1">Plans</span>
                    </Link>
                    <Link href="/account" className="flex flex-col items-center justify-center text-primary bg-primary-container/10 rounded-xl px-3 py-1 transition-all active:scale-[0.98]">
                        <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1, 'wght' 300" }}>person</span>
                        <span className="font-label-caps text-[10px] mt-1">Profile</span>
                    </Link>
                </div>
            </nav>
        </div>
    );
}
