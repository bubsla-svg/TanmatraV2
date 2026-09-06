"use client";

import React, { useId, useState } from 'react';
// Lucide is the storefront's icon system (21 other files). These five icons
// replaced `material-symbols-outlined` ligature spans — a font this app never
// loaded, so every one of them rendered its ligature name as literal text
// ("close", "check", "favorite", …) to real users. See
// scripts/lint-icon-font.ts for the gate that now catches an unloaded icon font.
import { Check, Heart, ThumbsDown, ThumbsUp, X } from 'lucide-react';

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
    // Stable id prefix so each visible <label> actually names its control.
    const uid = useId();
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[var(--scrim)] backdrop-blur-sm">
            <div className="bg-surface border border-line rounded-3xl p-6 max-w-md w-full text-ink shadow-2xl relative animate-in fade-in zoom-in-95 duration-200">
                {/* aria-label is load-bearing now: the ligature span this
                    replaced rendered the literal word "close", which was at
                    least SOMETHING a screen reader could announce. An SVG has
                    no text at all, so without this the dialog's only exit
                    would be an unnamed button. */}
                <button
                    type="button"
                    onClick={onClose}
                    aria-label="Close"
                    className="absolute top-5 right-5 flex min-h-11 min-w-11 items-center justify-center text-ink-muted hover:text-ink transition-colors"
                >
                    <X aria-hidden className="h-5 w-5" />
                </button>

                {submitted ? (
                    <div className="py-8 text-center space-y-3">
                        <div className="w-14 h-14 rounded-full bg-sage/10 border border-sage/30 text-sage flex items-center justify-center mx-auto">
                            <Check aria-hidden className="h-6 w-6" />
                        </div>
                        <h3 className="font-bold text-xl font-bold text-ink">Thank you for your feedback!</h3>
                        <p className="font-body-sm text-xs text-ink-muted">Your telemetry helps calibrate your metabolic nutrition plan.</p>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div>
                            <span className="font-bold text-xs text-gold uppercase tracking-widest font-bold">MEAL FEEDBACK</span>
                            <h2 className="font-bold text-xl font-bold text-ink mt-1">{mealName}</h2>
                            <p className="font-body-sm text-xs text-ink-muted mt-1">How was this meal in your dietary protocol?</p>
                        </div>

                        {/* Rating Options */}
                        <div className="grid grid-cols-3 gap-2">
                            <button
                                type="button"
                                onClick={() => setRating('loved-it')}
                                className={`flex flex-col items-center justify-center p-3 rounded-2xl border transition-all ${rating === 'loved-it' ? 'border-gold bg-gold/10 text-gold' : 'border-line bg-surface text-ink-muted hover:text-ink'}`}
                            >
                                {/* Filled when selected — the ligature span
                                    did this with `FILL 1`, and it is the
                                    non-colour half of the selected cue
                                    (SC 1.4.1), so it survives the port. */}
                                <Heart
                                    aria-hidden
                                    className="h-6 w-6 mb-1"
                                    fill={rating === 'loved-it' ? "currentColor" : "none"}
                                />
                                <span className="font-body-sm text-xs font-medium">Loved it</span>
                            </button>

                            <button
                                type="button"
                                onClick={() => setRating('good')}
                                className={`flex flex-col items-center justify-center p-3 rounded-2xl border transition-all ${rating === 'good' ? 'border-gold bg-gold/10 text-gold' : 'border-line bg-surface text-ink-muted hover:text-ink'}`}
                            >
                                <ThumbsUp aria-hidden className="h-6 w-6 mb-1" />
                                <span className="font-body-sm text-xs font-medium">It was okay</span>
                            </button>

                            <button
                                type="button"
                                onClick={() => setRating('not-for-me')}
                                className={`flex flex-col items-center justify-center p-3 rounded-2xl border transition-all ${rating === 'not-for-me' ? 'border-[var(--danger)] bg-[var(--danger)]/10 text-[var(--danger)]' : 'border-line bg-surface text-ink-muted hover:text-ink'}`}
                            >
                                <ThumbsDown aria-hidden className="h-6 w-6 mb-1" />
                                <span className="font-body-sm text-xs font-medium">Not for me</span>
                            </button>
                        </div>

                        {/* Structured Reasons (if selected) */}
                        {rating && (
                            <div className="space-y-2 animate-in fade-in duration-200">
                                <label className="font-bold text-xs text-ink-muted uppercase tracking-wider block">
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
                                <label className="font-bold text-xs text-ink-muted uppercase tracking-wider block" htmlFor={`${uid}-additional-details-optio`}>
                                    Additional details (Optional)
                                </label>
                                <textarea id={`${uid}-additional-details-optio`}
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
                            className="w-full bg-gold text-[var(--gold-ink)] font-bold text-xs uppercase tracking-widest font-bold py-3.5 rounded-full hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            Submit Feedback
                        </button>
                    </form>
                )}
            </div>
        </div>
    );
}
