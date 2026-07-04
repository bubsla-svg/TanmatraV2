import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { usePersonalisationStore } from '@/lib/usePersonalisationStore';
import { motion, AnimatePresence } from 'framer-motion';

const GOALS = [
  { id: 'weight_loss', label: 'Weight Loss', icon: '🔥' },
  { id: 'muscle_gain', label: 'Muscle Gain', icon: '💪' },
  { id: 'balanced_health', label: 'Balanced Health', icon: '⚖️' },
  { id: 'gut_healing', label: 'Gut Healing', icon: '🌿' },
];

const DIETS = ['Veg', 'Vegan', 'Keto', 'Gluten-Free', 'Jain'];
const ALLERGIES = ['Peanuts', 'Dairy', 'Soy', 'Tree Nuts', 'Shellfish'];

const DOSHAS = [
  { id: 'Vata', label: 'Vata', desc: 'Creative, energetic, tends toward dry skin & anxiety.' },
  { id: 'Pitta', label: 'Pitta', desc: 'Intense, focused, tends toward inflammation & acidity.' },
  { id: 'Kapha', label: 'Kapha', desc: 'Grounded, calm, tends toward sluggishness & weight gain.' },
  { id: 'Not Sure', label: 'Not Sure', desc: 'Help me balance all three.' },
];

export function PersonalisationWizard() {
  const {
    hasCompletedOnboarding,
    isOnboardingOpen,
    setOnboardingOpen,
    goal,
    setGoal,
    diet,
    toggleDiet,
    allergies,
    toggleAllergy,
    dosha,
    setDosha,
    completeOnboarding
  } = usePersonalisationStore();

  const [step, setStep] = useState(1);

  // Auto-trigger on first visit
  useEffect(() => {
    if (!hasCompletedOnboarding) {
      const timer = setTimeout(() => {
        setOnboardingOpen(true);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [hasCompletedOnboarding, setOnboardingOpen]);

  const handleNext = () => {
    if (step < 3) setStep(step + 1);
    else handleComplete();
  };

  const handleComplete = () => {
    completeOnboarding();
  };

  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <motion.div
            key="step1"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-4"
          >
            <h3 className="text-h3 font-semibold text-text-primary text-center mb-6">What is your primary goal?</h3>
            <div className="grid grid-cols-2 gap-3">
              {GOALS.map((g) => (
                <button
                  key={g.id}
                  onClick={() => {
                    setGoal(g.id);
                    setTimeout(handleNext, 300); // Auto-advance for tap reduction
                  }}
                  className={`p-4 rounded-card border-2 flex flex-col items-center gap-2 transition-all ${
                    goal === g.id
                      ? 'border-action bg-saffron-50 dark:bg-saffron-900/20 text-action-text'
                      : 'border-border bg-surface hover:border-action/50 text-text-primary'
                  }`}
                >
                  <span className="text-2xl">{g.icon}</span>
                  <span className="text-card-title font-medium">{g.label}</span>
                </button>
              ))}
            </div>
          </motion.div>
        );
      case 2:
        return (
          <motion.div
            key="step2"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-6"
          >
            <h3 className="text-h3 font-semibold text-text-primary text-center mb-4">Any dietary preferences?</h3>
            
            <div className="space-y-3">
              <label className="text-body-sm font-semibold text-text-secondary uppercase tracking-wider">Diets</label>
              <div className="flex flex-wrap gap-2">
                {DIETS.map((d) => (
                  <button
                    key={d}
                    onClick={() => toggleDiet(d)}
                    className={`px-4 py-2 rounded-pill text-body-sm font-medium transition-colors ${
                      diet.includes(d)
                        ? 'bg-sage-600 text-stone-0 border border-sage-600'
                        : 'bg-surface border border-border text-text-primary hover:bg-sage-50 dark:hover:bg-sage-900/30'
                    }`}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <label className="text-body-sm font-semibold text-text-secondary uppercase tracking-wider">Allergies (Avoid)</label>
              <div className="flex flex-wrap gap-2">
                {ALLERGIES.map((a) => (
                  <button
                    key={a}
                    onClick={() => toggleAllergy(a)}
                    className={`px-4 py-2 rounded-pill text-body-sm font-medium transition-colors ${
                      allergies.includes(a)
                        ? 'bg-clay-500 text-stone-0 border border-clay-500'
                        : 'bg-surface border border-border text-text-primary hover:bg-clay-100 dark:hover:bg-clay-700/30'
                    }`}
                  >
                    {a}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={handleNext}
              className="w-full mt-6 py-3 bg-action text-action-text font-semibold rounded-btn text-body-lg shadow-card-hover transition-transform hover:scale-[1.02]"
            >
              Continue
            </button>
          </motion.div>
        );
      case 3:
        return (
          <motion.div
            key="step3"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-4"
          >
            <h3 className="text-h3 font-semibold text-text-primary text-center mb-6">Know your Dosha?</h3>
            <div className="space-y-3">
              {DOSHAS.map((d) => (
                <button
                  key={d.id}
                  onClick={() => {
                    setDosha(d.id);
                    setTimeout(handleComplete, 300); // Auto-advance/complete
                  }}
                  className={`w-full p-4 rounded-card border-2 text-left transition-all ${
                    dosha === d.id
                      ? 'border-action bg-saffron-50 dark:bg-saffron-900/20'
                      : 'border-border bg-surface hover:border-action/50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-card-title font-semibold text-text-primary">{d.label}</span>
                    {dosha === d.id && <span className="text-action text-xl">✓</span>}
                  </div>
                  <p className="text-body-sm text-text-secondary mt-1">{d.desc}</p>
                </button>
              ))}
            </div>
          </motion.div>
        );
      default:
        return null;
    }
  };

  return (
    <Dialog open={isOnboardingOpen} onOpenChange={setOnboardingOpen}>
      <DialogContent className="sm:max-w-[425px] bg-surface border-border rounded-card p-6 overflow-hidden">
        <DialogHeader className="mb-4">
          <DialogTitle className="sr-only">Personalise your nutrition</DialogTitle>
          <DialogDescription className="sr-only">Set your health goals, allergies, and dosha.</DialogDescription>
          
          <div className="flex gap-2 justify-center pt-2">
            {[1, 2, 3].map((i) => (
              <div 
                key={i} 
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  step >= i ? 'bg-action w-8' : 'bg-border w-4'
                }`}
              />
            ))}
          </div>
        </DialogHeader>

        <div className="min-h-[300px]">
          <AnimatePresence mode="wait">
            {renderStep()}
          </AnimatePresence>
        </div>
      </DialogContent>
    </Dialog>
  );
}
