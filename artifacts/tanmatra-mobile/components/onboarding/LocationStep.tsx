import React, { useState } from "react";
import { Text, TextInput, View } from "react-native";
import { useColors } from "@/hooks/useColors";
import { Button } from "@/components/ui";

const PINCODE_LENGTH = 6;

/**
 * Step 3 — where do we deliver? Minimal manual pincode entry for the shell.
 * Real GPS detection + serviceability feedback (via expo-location and the
 * shared serviceable-pincode source) lands in PR 3 — this step deliberately
 * does not hardcode a serviceability list (that consolidation is PR 6). The
 * server re-validates serviceability at checkout regardless.
 */
export function LocationStep({
  onDone,
}: {
  onDone: (pincode: string) => void;
}) {
  const c = useColors();
  const [pincode, setPincode] = useState("");
  const [error, setError] = useState<string | null>(null);

  const valid = /^\d{6}$/.test(pincode);

  function submit() {
    if (!valid) {
      setError("Enter your 6-digit pincode.");
      return;
    }
    onDone(pincode);
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
        Where should we deliver?
      </Text>
      <Text style={{ color: c.mutedForeground, fontSize: 15, lineHeight: 21 }}>
        Enter your delivery pincode. We&apos;ll confirm we serve your area at
        checkout.
      </Text>

      <TextInput
        value={pincode}
        onChangeText={(t) => {
          setPincode(t.replace(/[^0-9]/g, "").slice(0, PINCODE_LENGTH));
          if (error) setError(null);
        }}
        keyboardType="number-pad"
        textContentType="postalCode"
        autoComplete="postal-code"
        maxLength={PINCODE_LENGTH}
        placeholder="201301"
        placeholderTextColor={c.zinc}
        accessibilityLabel="Delivery pincode"
        style={{
          color: c.foreground,
          fontSize: 18,
          paddingVertical: 14,
          paddingHorizontal: 14,
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
        title="Finish"
        onPress={submit}
        disabled={!valid}
        testID="location-finish"
      />
    </View>
  );
}
