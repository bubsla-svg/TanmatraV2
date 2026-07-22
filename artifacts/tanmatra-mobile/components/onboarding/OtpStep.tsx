import React, { useEffect, useRef, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/useColors";
import { Button } from "@/components/ui";
import {
  isCompleteOtp,
  maskPhone,
  OTP_LENGTH,
  type ParsedPhone,
} from "@/lib/onboarding/phone";
import {
  startResend,
  tickResend,
  canResend,
  type ResendState,
} from "@/lib/onboarding/otpTimer";
import { startSmsRetriever } from "@/lib/onboarding/smsRetriever";
import {
  sendOtp,
  verifyOtp,
  AuthError,
  type AuthGatewayConfig,
} from "@/lib/onboarding/authGateway";

/**
 * Step 2 — enter the 6-digit code. Auto-fill wires through the SMS-retriever
 * seam (no-op until the native module lands); manual entry always works. Verify
 * runs through the gateway seam: mock accepts "123456" in dev; live fails loud.
 */
export function OtpStep({
  phone,
  config,
  devCode,
  onVerified,
  onBack,
}: {
  phone: ParsedPhone;
  config: AuthGatewayConfig;
  devCode?: string;
  onVerified: (pendingRealAuth: boolean) => void;
  onBack: () => void;
}) {
  const c = useColors();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resend, setResend] = useState<ResendState>(() => startResend());
  const inputRef = useRef<TextInput>(null);

  // Countdown tick.
  useEffect(() => {
    const id = setInterval(() => setResend((s) => tickResend(s)), 1000);
    return () => clearInterval(id);
  }, []);

  // SMS auto-fill seam — fills the field if the native module delivers a code.
  useEffect(() => {
    const unsub = startSmsRetriever({ onCode: (c2) => setCode(c2) });
    return unsub;
  }, []);

  async function verify() {
    if (!isCompleteOtp(code)) {
      setError(`Enter the ${OTP_LENGTH}-digit code.`);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await verifyOtp(
        { countryCode: phone.countryCode, phone: phone.phone, code },
        config,
      );
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onVerified(res.pendingRealAuth);
    } catch (err) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError(
        err instanceof AuthError ? err.message : "Couldn't verify the code.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function resendCode() {
    if (!canResend(resend)) return;
    try {
      await sendOtp(
        { countryCode: phone.countryCode, phone: phone.phone },
        config,
      );
      setResend(startResend());
      setError(null);
    } catch (err) {
      setError(
        err instanceof AuthError ? err.message : "Couldn't resend the code.",
      );
    }
  }

  return (
    <View style={{ gap: 16 }}>
      <Text
        accessibilityRole="header"
        style={{
          color: c.foreground,
          fontFamily: "Inter_600SemiBold",
          fontSize: 24,
        }}
      >
        Enter the code
      </Text>
      <Text style={{ color: c.mutedForeground, fontSize: 15, lineHeight: 21 }}>
        Sent to {maskPhone(phone)}.{" "}
        <Text
          onPress={onBack}
          style={{ color: c.accent }}
          accessibilityRole="link"
        >
          Change
        </Text>
      </Text>

      {devCode && (
        <Text style={{ color: c.mutedForeground, fontSize: 13 }}>
          Dev code: {devCode}
        </Text>
      )}

      <TextInput
        ref={inputRef}
        value={code}
        onChangeText={(t) => {
          setCode(t.replace(/[^0-9]/g, "").slice(0, OTP_LENGTH));
          if (error) setError(null);
        }}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="sms-otp"
        maxLength={OTP_LENGTH}
        placeholder="••••••"
        placeholderTextColor={c.zinc}
        accessibilityLabel="6-digit verification code"
        style={{
          color: c.foreground,
          fontSize: 28,
          letterSpacing: 10,
          textAlign: "center",
          paddingVertical: 16,
          borderWidth: 1,
          borderColor: c.borderStrong,
          borderRadius: c.radius,
          backgroundColor: c.cardElevated,
        }}
      />

      {error && (
        <Text
          accessibilityLiveRegion="polite"
          style={{ color: c.destructive, fontSize: 14 }}
        >
          {error}
        </Text>
      )}

      <Button
        title="Verify"
        onPress={verify}
        loading={busy}
        disabled={!isCompleteOtp(code) || busy}
        testID="otp-verify"
      />

      <Pressable
        onPress={resendCode}
        disabled={!canResend(resend)}
        accessibilityRole="button"
        accessibilityLabel="Resend code"
        style={{ alignSelf: "center", padding: 8 }}
      >
        <Text
          style={{ color: canResend(resend) ? c.accent : c.zinc, fontSize: 14 }}
        >
          {canResend(resend)
            ? "Resend code"
            : `Resend in ${resend.secondsLeft}s`}
        </Text>
      </Pressable>
    </View>
  );
}
