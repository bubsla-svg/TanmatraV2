import React from "react";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { OnboardingFlow } from "@/components/onboarding/OnboardingFlow";
import { setOnboardingComplete } from "@/lib/onboarding/onboardingState";

/**
 * Onboarding route (phone → OTP → location shell). Reachable by explicit
 * navigation/deep-link for now; the forced "unauthenticated → onboarding"
 * redirect from the app entry lands with PR 4, once real auth is wired (a shell
 * that can't complete verification shouldn't trap every user on cold start).
 */
export default function OnboardingScreen() {
  const c = useColors();
  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: c.background }}
      edges={["top"]}
    >
      <OnboardingFlow
        onComplete={async () => {
          await setOnboardingComplete(true);
          router.replace("/");
        }}
      />
    </SafeAreaView>
  );
}
