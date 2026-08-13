"use client";

import React, { useState } from 'react';

export type RatingValue = 'loved-it' | 'good' | 'not-for-me';

export interface FeedbackSubmission {
    mealId: string;
    rating: RatingValue;
    reasons: string[];
    comments?: string;
    isPermanentExclusion: boolean;
}

interface MealFeedbackProps {
    mealId: string;
    mealName: string;
    isOpen: boolean;
    onClose: () => void;
    onSubmit?: (feedback: FeedbackSubmission) => void;
}

const FEEDBACK_REASONS = [
    'Taste',
    'Portion',
    'Spice',
    'Texture',
    'Too heavy',
    'Too light',
    'Ingredient',
    'Packaging'
];

export default function MealFeedback({
    mealId,
    mealName,
    isOpen,
    onClose,
    onSubmit
}: MealFeedbackProps) {
    const [rating, setRating] = useState<RatingValue | null>(null);
    const [selectedReasons, setSelectedReasons] = useState<string[]>([]);
    const [comments, setComments] = useState('');
    const [submitted, setSubmitted] = useState(false);

    if (!isOpen) return null;

    const toggleReason = (reason: string) => {
        setSelectedReasons(prev => 
            prev.includes(reason) 
                ? prev.filter(r => r !== reason)
                : [...prev, reason]
        );
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!rating) return;

        // Rule 15: A single negative response must not automatically become a permanent exclusion
        const feedbackPayload: FeedbackSubmission = {
            mealId,
            rating,
            reasons: selectedReasons,
            comments,
            isPermanentExclusion: false // Strictly non-permanent exclusion per Rule 15
        };

        if (onSubmit) {
            onSubmit(feedbackPayload);
        }

        setSubmitted(true);
        setTimeout(() => {
            setSubmitted(false);
            setRating(null);
            setSelectedReasons([]);
            setComments('');
            onClose();
        }, 1500);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-surface border border-line rounded-3xl p-6 max-w-md w-full text-ink shadow-2xl relative animate-in fade-in zoom-in-95 duration-200">
                <button 
                    onClick={onClose}
                    className="absolute top-5 right-5 text-ink-muted hover:text-ink transition-colors"
                >
                    <span className="material-symbols-outlined text-xl">close</span>
                </button>

                {submitted ? (
                    <div className="py-8 text-center space-y-3">
                        <div className="w-14 h-14 rounded-full bg-sage/10 border border-sage/30 text-sage flex items-center justify-center mx-auto">
                            <span className="material-symbols-outlined text-2xl">check</span>
                        </div>
                        <h3 className="font-headline-md text-xl font-bold text-ink">Thank you for your feedback!</h3>
                        <p className="font-body-sm text-xs text-ink-muted">Your telemetry helps calibrate your metabolic nutrition plan.</p>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div>
                            <span className="font-label-caps text-xs text-gold uppercase tracking-widest font-bold">MEAL FEEDBACK</span>
                            <h2 className="font-headline-md text-xl font-bold text-ink mt-1">{mealName}</h2>
                            <p className="font-body-sm text-xs text-ink-muted mt-1">How was this meal in your dietary protocol?</p>
                        </div>

                        {/* Rating Options */}
                        <div className="grid grid-cols-3 gap-2">
                            <button
                                type="button"
                                onClick={() => setRating('loved-it')}
                                className={`flex flex-col items-center justify-center p-3 rounded-2xl border transition-all ${rating === 'loved-it' ? 'border-gold bg-gold/10 text-gold' : 'border-line bg-surface text-ink-muted hover:text-ink'}`}
                            >
                                <span className="material-symbols-outlined text-2xl mb-1" style={{ fontVariationSettings: rating === 'loved-it' ? "'FILL' 1" : "'FILL' 0" }}>favorite</span>
                                <span className="font-body-sm text-xs font-medium">Loved it</span>
                            </button>

                            <button
                                type="button"
                                onClick={() => setRating('good')}
                                className={`flex flex-col items-center justify-center p-3 rounded-2xl border transition-all ${rating === 'good' ? 'border-gold bg-gold/10 text-gold' : 'border-line bg-surface text-ink-muted hover:text-ink'}`}
                            >
                                <span className="material-symbols-outlined text-2xl mb-1">thumb_up</span>
                                <span className="font-body-sm text-xs font-medium">It was okay</span>
                            </button>

                            <button
                                type="button"
                                onClick={() => setRating('not-for-me')}
                                className={`flex flex-col items-center justify-center p-3 rounded-2xl border transition-all ${rating === 'not-for-me' ? 'border-[var(--danger)] bg-[var(--danger)]/10 text-[var(--danger)]' : 'border-line bg-surface text-ink-muted hover:text-ink'}`}
                            >
                                <span className="material-symbols-outlined text-2xl mb-1">thumb_down</span>
                                <span className="font-body-sm text-xs font-medium">Not for me</span>
                            </button>
                        </div>

                        {/* Structured Reasons (if selected) */}
                        {rating && (
                            <div className="space-y-2 animate-in fade-in duration-200">
                                <label className="font-label-caps text-xs text-ink-muted uppercase tracking-wider block">
                                    {rating === 'loved-it' ? 'What stood out?' : 'What could be improved?'}
                                </label>
                                <div className="flex flex-wrap gap-2">
                                    {FEEDBACK_REASONS.map(reason => {
                                        const active = selectedReasons.includes(reason);
                                        return (
                                            <button
                                                key={reason}
                                                type="button"
                                                onClick={() => toggleReason(reason)}
                                                className={`px-3 py-1.5 rounded-full font-body-sm text-xs transition-all border ${active ? 'border-gold bg-gold text-[var(--gold-ink)] font-semibold' : 'border-line bg-surface text-ink hover:bg-surface'}`}
                                            >
                                                {reason}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* Additional Notes */}
                        {rating && (
                            <div className="space-y-2">
                                <label className="font-label-caps text-xs text-ink-muted uppercase tracking-wider block">
                                    Additional details (Optional)
                                </label>
                                <textarea
                                    value={comments}
                                    onChange={(e) => setComments(e.target.value)}
                                    placeholder="Add any specific culinary or clinical notes..."
                                    rows={2}
                                    className="w-full bg-bg border border-line rounded-xl p-3 text-xs text-ink placeholder-ink-muted focus:outline-none focus-visible:border-gold transition-colors resize-none"
                                />
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={!rating}
                            className="w-full bg-gold text-[var(--gold-ink)] font-label-caps text-xs uppercase tracking-widest font-bold py-3.5 rounded-full hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            Submit Feedback
                        </button>
                    </form>
                )}
            </div>
        </div>
    );
}
