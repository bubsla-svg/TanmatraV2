"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface ChallengeDetailClientProps {
    slug: string;
}

export default function ChallengeDetailClient({ slug }: ChallengeDetailClientProps) {
    const router = useRouter();
    const [isEnrolled, setIsEnrolled] = useState(false);
    const [commentText, setCommentText] = useState('');
    const [feedPosts, setFeedPosts] = useState([
        {
            id: '1',
            author: 'Alex Rivers',
            avatar: 'AR',
            time: '3h ago',
            content: 'Day 3 and feeling much lighter. The wild salmon reset bowl with cold-pressed olive dressing is a metabolic game changer!'
        },
        {
            id: '2',
            author: 'Maria Ross',
            avatar: 'MR',
            time: '1d ago',
            content: 'Prebiotic fiber intake hit 32g today without any afternoon bloat or brain fog. Excited for the live dietitian session on Friday!'
        }
    ]);

    // Format title from slug
    const formattedTitle = slug
        .split('-')
        .map(w => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');

    const handleEnroll = () => {
        setIsEnrolled(true);
        setTimeout(() => {
            router.push(`/plans?challenge=${encodeURIComponent(slug)}`);
        }, 600);
    };

    const handleAddPost = (e: React.FormEvent) => {
        e.preventDefault();
        if (commentText.trim()) {
            setFeedPosts(prev => [
                {
                    id: Date.now().toString(),
                    author: 'You (Cohort Member)',
                    avatar: 'YO',
                    time: 'Just now',
                    content: commentText.trim()
                },
                ...prev
            ]);
            setCommentText('');
        }
    };

    return (
        <div className="bg-[#FBFAF7] text-[#1A1C1E] min-h-screen pb-32">
            {/* Header */}
            <header className="w-full sticky top-0 bg-[#FBFAF7] z-40 border-b border-[#E7E3DA] px-4 h-16 flex items-center justify-between max-w-[1200px] mx-auto">
                <Link href="/challenges" className="flex items-center gap-2 text-xs font-bold text-[#5C6367] hover:text-[#1A1C1E]">
                    <span className="material-symbols-outlined text-sm">arrow_back</span>
                    All Challenges
                </Link>
                <div className="flex items-center gap-3">
                    <span className="bg-[#EBF2EB] text-[#4F6B50] text-[10px] font-label-caps font-bold px-2.5 py-1 rounded-full uppercase">
                        218 Cohort Members
                    </span>
                </div>
            </header>

            <main className="max-w-[800px] mx-auto px-4 py-8 space-y-10">
                {/* Hero Banner */}
                <section className="space-y-6">
                    <div className="relative w-full aspect-video rounded-3xl overflow-hidden border border-[#E7E3DA] shadow-sm bg-[#E7E3DA]">
                        <img 
                            src="https://lh3.googleusercontent.com/aida/AP1WRLumTq0n6IWkUuPlhpimbhO_npxhG-p5Fe_MLMqGImMj2Jz901wzGHzpihSWuno0n_THUTmsSp2ua1pU0Qb-HFNrQkXa_tjE1_eE_f_hTT1lBA8ov_gtWyzzX10tPDfsOBM7OyYELS4m_NN48vJjrOjmgFAww0aQe6FS7Hw9QR0q9IB8cwe17_EHqzUYa7dlK30PtZn9JcSuTmTr6U0VEB_71BgHTc_Rmf6ODAnku0RnRDrpmdwW-cb7baA"
                            alt={formattedTitle}
                            className="w-full h-full object-cover"
                        />
                        <div className="absolute top-4 left-4 bg-white/90 backdrop-blur-md px-3 py-1 rounded-full text-xs font-label-caps text-[#D4AF37] font-bold border border-[#E7E3DA]">
                            COHORT PROTOCOL
                        </div>
                    </div>

                    <div className="space-y-3">
                        <div className="flex items-center gap-2">
                            <span className="bg-[#EBF2EB] text-[#4F6B50] px-3 py-1 rounded-full font-label-caps text-xs font-bold">
                                Active Cohort · Starts Monday
                            </span>
                        </div>
                        <h1 className="font-headline-md text-3xl md:text-4xl font-bold text-[#1A1C1E]">
                            {formattedTitle || '14-Day Fibre & Glycemic Reset'}
                        </h1>
                        <p className="font-body-md text-sm md:text-base text-[#5C6367] leading-relaxed">
                            A two-week guided protocol designed to systematically reintroduce diverse prebiotic fibers and zero-seed-oil metabolic meals. 
                            Curated daily meal kits, weekly live RD Q&amp;A sessions, and cohort accountability.
                        </p>
                    </div>

                    <div className="flex flex-wrap gap-2 pt-2">
                        <span className="px-3 py-1 bg-white border border-[#E7E3DA] rounded-full text-xs font-medium text-[#5C6367]">Gut Microbiome</span>
                        <span className="px-3 py-1 bg-white border border-[#E7E3DA] rounded-full text-xs font-medium text-[#5C6367]">High Prebiotic Fiber</span>
                        <span className="px-3 py-1 bg-white border border-[#E7E3DA] rounded-full text-xs font-medium text-[#5C6367]">RD-Guided</span>
                    </div>

                    {/* Enrollment Card */}
                    <div className="bg-white border border-[#E7E3DA] rounded-2xl p-6 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
                        <div>
                            <span className="font-label-caps text-[10px] text-[#D4AF37] uppercase tracking-widest font-bold block">JOIN THE COHORT</span>
                            <h3 className="font-headline-md text-base font-bold text-[#1A1C1E]">Full 14-Day Challenge Kit</h3>
                            <p className="font-body-sm text-xs text-[#5C6367]">Includes 14 daily metabolic meals + 2 live RD sessions</p>
                        </div>
                        <button 
                            onClick={handleEnroll}
                            disabled={isEnrolled}
                            className="w-full sm:w-auto bg-[#D4AF37] text-[#1A1C1E] font-label-caps text-xs font-bold px-8 py-3.5 rounded-full hover:opacity-90 active:scale-[0.98] transition-all shadow-sm shrink-0 cursor-pointer"
                        >
                            {isEnrolled ? 'Enrolling & Customizing Plan...' : 'Enroll in Challenge'}
                        </button>
                    </div>
                </section>

                {/* Upcoming Live Sessions */}
                <section className="space-y-4">
                    <h2 className="font-headline-md text-xl font-bold text-[#1A1C1E]">Upcoming Live RD Check-ins</h2>
                    <div className="bg-white border border-[#E7E3DA] rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
                        <div className="space-y-1">
                            <span className="font-label-caps text-[10px] text-[#4F6B50] uppercase font-bold bg-[#EBF2EB] px-2.5 py-0.5 rounded-full">
                                Video Stream
                            </span>
                            <h3 className="font-headline-md text-base font-bold text-[#1A1C1E]">Live Q&amp;A — Blunting Postprandial Glucose Spikes</h3>
                            <p className="font-data-md text-xs text-[#5C6367]">Friday, 5:00 PM IST · Host: Dr. Ananya Sharma, RD</p>
                        </div>
                        <Link 
                            href="/account/appointments" 
                            className="bg-[#FBFAF7] border border-[#E7E3DA] text-[#1A1C1E] font-label-caps text-xs font-bold px-5 py-2.5 rounded-full hover:bg-white transition-colors self-start sm:self-auto"
                        >
                            RSVP Free
                        </Link>
                    </div>
                </section>

                {/* Community Feed */}
                <section className="space-y-6">
                    <h2 className="font-headline-md text-xl font-bold text-[#1A1C1E]">Cohort Community Feed</h2>
                    
                    {/* Composer */}
                    <form onSubmit={handleAddPost} className="bg-white border border-[#E7E3DA] rounded-2xl p-4 shadow-sm space-y-3">
                        <textarea 
                            value={commentText}
                            onChange={(e) => setCommentText(e.target.value)}
                            placeholder="Share your daily meal log or ask a question to the cohort..."
                            rows={3}
                            className="w-full bg-[#FBFAF7] border border-[#E7E3DA] rounded-xl p-3 text-xs text-[#1A1C1E] focus:outline-none focus:border-[#D4AF37] resize-none"
                        />
                        <div className="flex justify-end">
                            <button 
                                type="submit"
                                className="bg-[#D4AF37] text-[#1A1C1E] font-label-caps text-xs font-bold px-5 py-2 rounded-full hover:opacity-90 transition-opacity"
                            >
                                Share Update
                            </button>
                        </div>
                    </form>

                    {/* Feed Posts */}
                    <div className="space-y-4">
                        {feedPosts.map(post => (
                            <div key={post.id} className="bg-white border border-[#E7E3DA] rounded-2xl p-5 shadow-sm space-y-2">
                                <div className="flex items-center gap-3">
                                    <div className="w-9 h-9 rounded-full bg-[#FBFAF7] border border-[#E7E3DA] flex items-center justify-center font-bold text-xs text-[#D4AF37]">
                                        {post.avatar}
                                    </div>
                                    <div>
                                        <h4 className="font-headline-md text-xs font-bold text-[#1A1C1E]">{post.author}</h4>
                                        <span className="font-data-md text-[10px] text-[#8B9194]">{post.time}</span>
                                    </div>
                                </div>
                                <p className="font-body-sm text-xs text-[#5C6367] leading-relaxed">
                                    {post.content}
                                </p>
                            </div>
                        ))}
                    </div>
                </section>
            </main>
        </div>
    );
}
