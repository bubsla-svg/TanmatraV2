import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface PersonalisationState {
  hasCompletedOnboarding: boolean;
  goal: string | null;
  diet: string[];
  allergies: string[];
  dosha: string | null;
  setGoal: (goal: string) => void;
  toggleDiet: (diet: string) => void;
  toggleAllergy: (allergy: string) => void;
  setDosha: (dosha: string) => void;
  completeOnboarding: () => void;
  resetOnboarding: () => void;
  isOnboardingOpen: boolean;
  setOnboardingOpen: (isOpen: boolean) => void;
}

export const usePersonalisationStore = create<PersonalisationState>()(
  persist(
    (set) => ({
      hasCompletedOnboarding: false,
      goal: null,
      diet: [],
      allergies: [],
      dosha: null,
      isOnboardingOpen: false,

      setGoal: (goal) => set({ goal }),
      
      toggleDiet: (dietItem) => set((state) => ({
        diet: state.diet.includes(dietItem)
          ? state.diet.filter((d) => d !== dietItem)
          : [...state.diet, dietItem]
      })),

      toggleAllergy: (allergy) => set((state) => ({
        allergies: state.allergies.includes(allergy)
          ? state.allergies.filter((a) => a !== allergy)
          : [...state.allergies, allergy]
      })),

      setDosha: (dosha) => set({ dosha }),

      completeOnboarding: () => set({ hasCompletedOnboarding: true, isOnboardingOpen: false }),

      resetOnboarding: () => set({ 
        hasCompletedOnboarding: false, 
        goal: null, 
        diet: [], 
        allergies: [], 
        dosha: null,
        isOnboardingOpen: true 
      }),

      setOnboardingOpen: (isOpen) => set({ isOnboardingOpen: isOpen }),
    }),
    {
      name: 'tanmatra-personalisation-storage',
    }
  )
);
