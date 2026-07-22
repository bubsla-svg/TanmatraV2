import React, { useState } from "react";
import { Text, TextInput, View } from "react-native";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/useColors";
import { Button } from "@/components/ui";
import {
  parsePhone,
  DEFAULT_COUNTRY_CODE,
  type ParsedPhone,
} from "@/lib/onboarding/phone";
import {
  sendOtp,
  AuthError,
  type AuthGatewayConfig,
} from "@/lib/onboarding/authGateway";

/**
 * Step 1 — collect the phone number and trigger the OTP SMS via the real
 * send-otp endpoint. Validates the number client-side before the network call.
 */
export function PhoneStep({
  config,
  onSent,
}: {
  config: AuthGatewayConfig;
  onSent: (phone: ParsedPhone, devCode?: string) => void;
}) {
  const c = useColors();
  const [raw, setRaw] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parsed = parsePhone(raw);
  const canSubmit = parsed !== null && !busy;

  async function submit() {
    const p = parsePhone(raw);
    if (!p) {
      setError("Enter a valid 10-digit mobile number.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await sendOtp(
        { countryCode: p.countryCode, phone: p.phone },
        config,
      );
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onSent(p, res.devCode);
    } catch (err) {
      const msg =
        err instanceof AuthError ? err.message : "Something went wrong.";
      setError(msg);
    } finally {
      setBusy(false);
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
        What&apos;s your number?
      </Text>
      <Text style={{ color: c.mutedForeground, fontSize: 15, lineHeight: 21 }}>
        We&apos;ll text you a 6-digit code to confirm it&apos;s you.
      </Text>

      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
          borderWidth: 1,
          borderColor: c.borderStrong,
          borderRadius: c.radius,
          paddingHorizontal: 14,
          backgroundColor: c.cardElevated,
        }}
      >
        <Text style={{ color: c.foreground, fontSize: 16 }}>
          {DEFAULT_COUNTRY_CODE}
        </Text>
        <TextInput
          value={raw}
          onChangeText={(t) => {
            setRaw(t);
            if (error) setError(null);
          }}
          keyboardType="phone-pad"
          textContentType="telephoneNumber"
          autoComplete="tel"
          maxLength={12}
          placeholder="98765 43210"
          placeholderTextColor={c.zinc}
          accessibilityLabel="Mobile number"
          style={{
            flex: 1,
            color: c.foreground,
            fontSize: 16,
            paddingVertical: 14,
          }}
        />
      </View>

      {error && (
        <Text
          accessibilityLiveRegion="polite"
          style={{ color: c.destructive, fontSize: 14 }}
        >
          {error}
        </Text>
      )}

      <Button
        title="Send code"
        onPress={submit}
        loading={busy}
        disabled={!canSubmit}
        testID="phone-send"
      />
    </View>
  );
}
