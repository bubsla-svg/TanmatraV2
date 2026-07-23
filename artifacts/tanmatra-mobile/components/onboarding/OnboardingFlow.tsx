import React, { useState } from "react";
import { View } from "react-native";
import { useColors } from "@/hooks/useColors";
import { API_BASE } from "@/lib/activity";
import type { ParsedPhone } from "@/lib/onboarding/phone";
import type { AuthGatewayConfig } from "@/lib/onboarding/authGateway";
import { PhoneStep } from "./PhoneStep";
import { OtpStep } from "./OtpStep";
import { LocationStep } from "./LocationStep";

export interface OnboardingResult {
  phone: ParsedPhone;
  /** From LocationStep (PR 3 makes this a real GPS/pincode result). */
  pincode: string;
  /**
   * True when the OTP was accepted by the mock auth provider rather than a real
   * server session. The caller must NOT treat the user as durably signed in.
   * See lib/onboarding/authGateway.ts.
   */
  pendingRealAuth: boolean;
}

type Step = "phone" | "otp" | "location";

/**
 * The mobile onboarding shell: phone → OTP → location. Auth runs through the
 * gateway seam (real send-otp; verify is mock in dev / fails loud in prod).
 * `onComplete` fires only after all three steps; it never implies a real
 * session on its own — check `result.pendingRealAuth`.
 */
export function OnboardingFlow({
  onComplete,
}: {
  onComplete: (result: OnboardingResult) => void;
}) {
  const c = useColors();
  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState<ParsedPhone | null>(null);
  const [devCode, setDevCode] = useState<string | undefined>(undefined);
  const [pendingRealAuth, setPendingRealAuth] = useState(false);

  const config: AuthGatewayConfig = { apiBase: API_BASE };

  return (
    <View style={{ flex: 1, backgroundColor: c.background, padding: 20 }}>
      {step === "phone" && (
        <PhoneStep
          config={config}
          onSent={(p, code) => {
            setPhone(p);
            setDevCode(code);
            setStep("otp");
          }}
        />
      )}

      {step === "otp" && phone && (
        <OtpStep
          phone={phone}
          config={config}
          devCode={devCode}
          onBack={() => setStep("phone")}
          onVerified={(pending) => {
            setPendingRealAuth(pending);
            setStep("location");
          }}
        />
      )}

      {step === "location" && phone && (
        <LocationStep
          onDone={(pincode) => onComplete({ phone, pincode, pendingRealAuth })}
        />
      )}
    </View>
  );
}
