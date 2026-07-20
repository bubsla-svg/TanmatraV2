import {createBaseEvent, trackEvent} from '@/lib/analytics/track';
import {readTodayActivity, API_BASE} from '@/lib/activity';
import {clearToken, loadToken, saveToken} from '@/lib/auth';
import {useColors} from '@/hooks/useColors';
import {useQueryClient} from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

const topPad = 10;
const bottomPad = 10;

function Card({children}: {children?: React.ReactNode}) {
  const c = useColors();
  return (
    <View
      style={{
        backgroundColor: c.cardElevated,
        padding: 16,
        borderRadius: c.radius,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: c.borderStrong,
      }}>
      {children}
    </View>
  );
}

function Label({children}: {children?: React.ReactNode}) {
  const c = useColors();
  return (
    <Text
      style={{
        color: c.foreground,
        fontFamily: 'Inter_600SemiBold',
        fontSize: 14,
      }}>
      {children}
    </Text>
  );
}

function Button({
  title,
  onPress,
  testID,
}: {
  title: string;
  onPress: () => void | Promise<void>;
  testID?: string;
}) {
  const c = useColors();
  // Guard against double-taps: while an async handler is in flight the button
  // is disabled and shows a spinner, so a second tap can't fire a duplicate
  // connect/sync/pair request.
  const [pending, setPending] = useState(false);
  const handlePress = useCallback(async () => {
    if (pending) return;
    setPending(true);
    try {
      await onPress();
    } finally {
      setPending(false);
    }
  }, [pending, onPress]);
  return (
    <Pressable
      onPress={handlePress}
      disabled={pending}
      testID={testID}
      style={{
        backgroundColor: c.primary,
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: c.radius,
        alignItems: 'center',
        opacity: pending ? 0.6 : 1,
      }}>
      {pending ? (
        <ActivityIndicator color={c.primaryForeground} />
      ) : (
        <Text
          style={{
            color: c.primaryForeground,
            fontFamily: 'Inter_600SemiBold',
            fontSize: 14,
          }}>
          {title}
        </Text>
      )}
    </Pressable>
  );
}

function clampInt(val: string, max: number): number {
  const n = parseInt(val, 10);
  if (isNaN(n) || n < 0) return 0;
  return Math.min(n, max);
}

function providerLabel(p: string): string {
  return p === 'apple_health'
    ? 'Apple Health'
    : p === 'health_connect'
      ? 'Health Connect'
      : 'Unknown Health Source';
}

function relativeTime(isoString: string): string {
  const then = new Date(isoString).getTime();
  if (Number.isNaN(then)) return 'unknown';
  const diffMs = Date.now() - then;
  if (diffMs < 60_000) return 'just now';
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 60) return `${mins} min${mins === 1 ? '' : 's'} ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hr${hours === 1 ? '' : 's'} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}


export default function HomeScreen() {
  const c = useColors();
  const [token, setTokenState] = useState<string | null>(null);
  const [tokenReady, setTokenReady] = useState<boolean>(false);
  const [tokenInput, setTokenInput] = useState<string>('');
  const [stepsInput, setStepsInput] = useState<string>('');
  const [kcalInput, setKcalInput] = useState<string>('');
  const [showPairHelp, setShowPairHelp] = useState<boolean>(false);
  // Honest defaults: nothing is "connected" and nothing has "synced" until
  // the user actually does it in this session — the previous fabricated
  // `true` / `new Date()` pair rendered "Connected · Last sync 2 mins ago"
  // on a fresh install that had never synced anything.
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | undefined>(undefined);

  const provider = useMemo(() => {
    return Platform.OS === 'ios'
      ? 'apple_health'
      : Platform.OS === 'android'
        ? 'health_connect'
        : 'unknown';
  }, []);

  const providerForAnalytics =
    provider === 'apple_health'
      ? 'apple_health'
      : provider === 'health_connect'
        ? 'health_connect'
        : 'unknown';

  const screenForAnalytics: 'pairing' | 'home' = token ? 'home' : 'pairing';
  const baseEvent = createBaseEvent({
    screen: screenForAnalytics,
    provider: providerForAnalytics,
  });

  // Hydrate the persisted pairing token on cold start so a reload keeps the
  // paired session instead of dumping the user back on the pairing screen.
  useEffect(() => {
    let active = true;
    void (async () => {
      const stored = await loadToken();
      if (!active) return;
      if (stored) setTokenState(stored);
      setTokenReady(true);
    })();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!tokenReady) return;
    if (!token) {
      trackEvent('pairing_view', {
        ...createBaseEvent({
          screen: 'pairing',
          provider: providerForAnalytics,
        }),
      });
    }
  }, [tokenReady, token, providerForAnalytics]);

  const setToken = useCallback(async (newToken: string | null) => {
    // Persist to (or clear from) the secure enclave so the session survives
    // reloads. Both the pair flow and sign-out route through here.
    if (newToken) {
      await saveToken(newToken);
      setTokenState(newToken);
    } else {
      // Clear persisted storage FIRST. If it throws (native delete failure) we
      // deliberately do NOT flip to signed-out, so the UI keeps reflecting the
      // still-authenticated reality and the user can retry — never a fake
      // sign-out that leaves the token resurrectable on next cold start.
      await clearToken();
      setTokenState(null);
    }
  }, []);

  // Pull-to-refresh re-reads today's totals from the native health source
  // (no-op prefill when the store isn't available, e.g. Expo Go) — the
  // previous implementation refreshed nothing and just closed the spinner.
  const refreshAll = useCallback(async () => {
    setRefreshing(true);
    try {
      const reading = await readTodayActivity();
      if (reading) {
        setStepsInput(String(reading.steps));
        setKcalInput(String(reading.activityKcal));
      }
    } finally {
      setRefreshing(false);
    }
  }, []);

  const queryClient = useQueryClient();

  const connect = useMemo(
    () => ({
      mutateAsync: async (args: {data: {provider: string}}) => {
        if (!token) throw new Error('Not authenticated');
        const res = await fetch(`${API_BASE}/wellness/wearable/connect`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(args.data),
        });
        if (!res.ok) {
          const text = await res.text().catch(() => '');
          throw new Error(`Connect failed (${res.status}): ${text || res.statusText}`);
        }
        setIsConnected(true);
        return res.json();
      },
    }),
    [token],
  );

  const disconnect = useMemo(
    () => ({
      mutateAsync: async (args: {data: {provider: string}}) => {
        if (!token) throw new Error('Not authenticated');
        const res = await fetch(`${API_BASE}/wellness/wearable/disconnect`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(args.data),
        });
        if (!res.ok) {
          const text = await res.text().catch(() => '');
          throw new Error(`Disconnect failed (${res.status}): ${text || res.statusText}`);
        }
        setIsConnected(false);
        return res.json();
      },
    }),
    [token],
  );

  const sync = useMemo(
    () => ({
      mutateAsync: async (args: {
        data: {provider: string; activityKcal: number; steps: number};
      }) => {
        if (!token) throw new Error('Not authenticated');
        const res = await fetch(`${API_BASE}/wellness/wearable/sync`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(args.data),
        });
        if (!res.ok) {
          const text = await res.text().catch(() => '');
          throw new Error(`Sync failed (${res.status}): ${text || res.statusText}`);
        }
        return res.json();
      },
    }),
    [token],
  );

  const handleSaveToken = useCallback(async () => {
    const trimmed = tokenInput.trim();
    if (trimmed.length < 8) {
      trackEvent('pairing_invalid_token', {
        ...createBaseEvent({
          screen: 'pairing',
          provider: providerForAnalytics,
        }),
        length: trimmed.length,
      });
      Alert.alert(
        'Invalid token',
        'Paste the device pairing token from the web app.',
      );
      return;
    }
    // Verify against the server BEFORE celebrating: previously any ≥8-char
    // string was saved and announced as "paired", and the user only found
    // out at their first sync (401). /wellness/today is the cheapest
    // authenticated read.
    try {
      const res = await fetch(`${API_BASE}/wellness/today`, {
        headers: {Authorization: `Bearer ${trimmed}`},
      });
      if (!res.ok) {
        trackEvent('pairing_invalid_token', {
          ...createBaseEvent({
            screen: 'pairing',
            provider: providerForAnalytics,
          }),
          length: trimmed.length,
        });
        Alert.alert(
          'Token not recognized',
          'The server rejected this pairing token. Generate a fresh one from the web app and paste it here.',
        );
        return;
      }
    } catch {
      Alert.alert(
        'Could not verify token',
        "We couldn't reach Tanmatra to verify this token. Check your connection and try again.",
      );
      return;
    }
    await setToken(trimmed);
    trackEvent('pairing_success', {
      ...createBaseEvent({
        screen: 'pairing',
        provider: providerForAnalytics,
      }),
    });
    setTokenInput('');
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await refreshAll();
  }, [tokenInput, setToken, refreshAll, providerForAnalytics]);

  const handleConnect = useCallback(async () => {
    trackEvent('wearable_connect_clicked', {
      ...createBaseEvent({
        screen: token ? 'home' : 'pairing',
        provider: providerForAnalytics,
      }),
    });
    try {
      await connect.mutateAsync({data: {provider}});
      trackEvent('wearable_connected', {
        ...createBaseEvent({
          screen: 'home',
          provider: providerForAnalytics,
        }),
      });
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await refreshAll();
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Unknown error';
      trackEvent('wearable_connect_failed', {
        ...createBaseEvent({
          screen: token ? 'home' : 'pairing',
          provider: providerForAnalytics,
        }),
        message,
      });
      Alert.alert('Connect failed', message);
    }
  }, [connect, provider, refreshAll, providerForAnalytics, token]);

  const handleDisconnect = useCallback(async () => {
    try {
      await disconnect.mutateAsync({data: {provider}});
      trackEvent('wearable_disconnected', {
        ...createBaseEvent({
          screen: 'home',
          provider: providerForAnalytics,
        }),
      });
      await refreshAll();
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Unknown error';
      trackEvent('wearable_disconnect_failed', {
        ...createBaseEvent({
          screen: 'home',
          provider: providerForAnalytics,
        }),
        message,
      });
      Alert.alert('Disconnect failed', message);
    }
  }, [disconnect, provider, refreshAll, providerForAnalytics]);

  const handleAutoFill = useCallback(async () => {
    trackEvent('autofill_clicked', {
      ...createBaseEvent({
        screen: token ? 'home' : 'pairing',
        provider: providerForAnalytics,
      }),
    });
    const reading = await readTodayActivity();
    if (!reading) {
      trackEvent('autofill_unavailable', {
        ...createBaseEvent({
          screen: token ? 'home' : 'pairing',
          provider: providerForAnalytics,
        }),
      });
      Alert.alert(
        'Native health source unavailable',
        `${providerLabel(provider)} requires a custom build of this app. For now, enter today's totals manually.`,
      );
      return;
    }
    setStepsInput(String(reading.steps));
    setKcalInput(String(reading.activityKcal));
  }, [provider, providerForAnalytics, token]);

  const handleSync = useCallback(async () => {
    const stepsRaw = Number(stepsInput);
    const kcalRaw = Number(kcalInput);
    if (stepsInput && (Number.isNaN(stepsRaw) || stepsRaw > 60000)) {
      Alert.alert(
        'Steps look off',
        'Enter a whole number of steps between 0 and 60,000 for today.',
      );
      return;
    }
    if (kcalInput && (Number.isNaN(kcalRaw) || kcalRaw > 3000)) {
      Alert.alert(
        'Active calories look off',
        'Enter a whole number of kcal between 0 and 3,000 for today.',
      );
      return;
    }
    const steps = clampInt(stepsInput, 60000);
    const activityKcal = clampInt(kcalInput, 3000);

    trackEvent('activity_sync_attempted', {
      ...createBaseEvent({
        screen: 'home',
        provider: providerForAnalytics,
      }),
      steps,
      activityKcal,
    });

    if (activityKcal === 0 && steps === 0) {
      Alert.alert(
        'Nothing to sync',
        "Enter today's steps or active calories first.",
      );
      return;
    }

    try {
      await sync.mutateAsync({
        data: {provider, activityKcal, steps},
      });
      trackEvent('activity_sync_success', {
        ...createBaseEvent({
          screen: 'home',
          provider: providerForAnalytics,
        }),
        steps,
        activityKcal,
      });
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setLastSyncedAt(new Date().toISOString());
      setStepsInput('');
      setKcalInput('');
      await refreshAll();
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Unknown error';
      trackEvent('activity_sync_failed', {
        ...createBaseEvent({
          screen: 'home',
          provider: providerForAnalytics,
        }),
        message,
      });
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Sync failed', message);
    }
  }, [stepsInput, kcalInput, provider, sync, refreshAll, providerForAnalytics]);

  const handleSignOut = useCallback(async () => {
    trackEvent('signout_clicked', {
      ...createBaseEvent({
        screen: 'home',
        provider: providerForAnalytics,
      }),
    });

    Alert.alert(
      'Sign out of Tanmatra?',
      "You'll need to paste a fresh device pairing token from the web app to sync again.",
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Sign out',
          style: 'destructive',
          onPress: async () => {
            trackEvent('signout_confirmed', {
              ...createBaseEvent({
                screen: 'home',
                provider: providerForAnalytics,
              }),
            });
            try {
              await setToken(null);
              queryClient.clear();
            } catch {
              Alert.alert(
                'Sign out incomplete',
                "We couldn't clear your saved session from this device. Please try again.",
              );
            }
          },
        },
      ],
    );
  }, [setToken, queryClient, providerForAnalytics]);

  // Don't flash the pairing screen at an already-paired user while the stored
  // token is still hydrating from the secure store.
  if (!tokenReady) {
    return <View style={{flex: 1, backgroundColor: c.background}} />;
  }

  if (!token) {
    return (
      <ScrollView
        style={{flex: 1, backgroundColor: c.background}}
        contentContainerStyle={{
          paddingTop: topPad + 24,
          paddingBottom: bottomPad + 28,
          paddingHorizontal: 20,
          gap: 18,
        }}
        keyboardShouldPersistTaps="handled">
        <View style={{gap: 8}}>
          <Text
            style={{
              color: c.foreground,
              fontFamily: 'Inter_700Bold',
              fontSize: 32,
              letterSpacing: -0.8,
            }}>
            Tanmatra
          </Text>
          <Text
            style={{
              color: c.mutedForeground,
              fontFamily: 'Inter_400Regular',
              fontSize: 15,
              lineHeight: 22,
            }}>
            Pair this device to push daily activity from{' '}
            {providerLabel(provider)} into your wellness dashboard.
          </Text>
        </View>

        <Card>
          <Label>Quick setup</Label>
          <View style={{height: 10}} />
          <View style={{gap: 6}}>
            <Text
              style={{
                color: c.zinc,
                fontFamily: 'Inter_500Medium',
                fontSize: 12,
              }}>
              1. Open Tanmatra web → Settings → Pair device
            </Text>
            <Text
              style={{
                color: c.zinc,
                fontFamily: 'Inter_500Medium',
                fontSize: 12,
              }}>
              2. Generate token (auto-copied)
            </Text>
            <Text
              style={{
                color: c.zinc,
                fontFamily: 'Inter_500Medium',
                fontSize: 12,
              }}>
              3. Paste token below and tap Pair device
            </Text>
          </View>
        </Card>

        <Card>
          <Label>Device pairing token</Label>
          <TextInput
            value={tokenInput}
            onChangeText={setTokenInput}
            placeholder="Paste token from web → Settings"
            placeholderTextColor={c.zinc}
            autoCapitalize="none"
            autoCorrect={false}
            secureTextEntry
            style={{
              marginTop: 12,
              borderWidth: StyleSheet.hairlineWidth,
              borderColor: c.borderStrong,
              borderRadius: c.radius,
              paddingHorizontal: 14,
              paddingVertical: 14,
              color: c.foreground,
              backgroundColor: c.cardElevated,
              fontFamily: 'Inter_500Medium',
              fontSize: 14,
            }}
          />

          <View style={{height: 10}} />
          <Text
            style={{
              color: c.zinc,
              fontFamily: 'Inter_400Regular',
              fontSize: 12,
            }}>
            Tip: long-press the field and tap Paste.
          </Text>

          <View style={{height: 14}} />
          <Button
            title="Pair device"
            onPress={handleSaveToken}
            testID="pair-button"
          />

          <View style={{height: 12}} />
          <Pressable
            onPress={() => setShowPairHelp((v: boolean) => !v)}
            accessibilityRole="button"
            accessibilityLabel="Toggle pairing help"
            style={{
              alignSelf: 'flex-start',
              paddingVertical: 4,
              paddingHorizontal: 2,
            }}>
            <Text
              style={{
                color: c.primary,
                fontFamily: 'Inter_500Medium',
                fontSize: 12,
              }}>
              {showPairHelp ? 'Hide help' : 'Need help?'}
            </Text>
          </Pressable>

          {showPairHelp ? (
            <>
              <View style={{height: 8}} />
              <Text
                style={{
                  color: c.zinc,
                  fontFamily: 'Inter_400Regular',
                  fontSize: 12,
                  lineHeight: 18,
                }}>
                On the Tanmatra web app, sign in and open{' '}
                <Text
                  style={{color: c.foreground, fontFamily: 'Inter_500Medium'}}>
                  tanmatra.food/wellness#pair-device
                </Text>
                . Tap{' '}
                <Text
                  style={{color: c.foreground, fontFamily: 'Inter_500Medium'}}>
                  Generate
                </Text>{' '}
                — the token is copied automatically. Return here and paste.
              </Text>
            </>
          ) : null}
        </Card>
      </ScrollView>
    );
  }

  return (
    <ScrollView
      style={{flex: 1, backgroundColor: c.background}}
      contentContainerStyle={{
        paddingTop: topPad + 24,
        paddingBottom: bottomPad + 28,
        paddingHorizontal: 20,
        gap: 18,
      }}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={refreshAll}
          tintColor={c.primary}
        />
      }>
      <View style={{gap: 8}}>
        <Text
          style={{
            color: c.foreground,
            fontFamily: 'Inter_700Bold',
            fontSize: 28,
          }}>
          Wellness Dashboard
        </Text>
      </View>

      <Card>
        <Label>Wearable status</Label>
        <Text
          style={{
            color: isConnected ? c.mutedForeground : c.destructive,
            fontFamily: 'Inter_500Medium',
            fontSize: 12,
            marginTop: 2,
          }}>
          {isConnected
            ? `Connected · ${lastSyncedAt ? `Last sync ${relativeTime(lastSyncedAt)}` : 'Not synced yet'}`
            : 'Not connected · Connect to enable sync'}
        </Text>
        <View style={{height: 12}} />
        {isConnected ? (
          <Button title="Disconnect Wearable" onPress={handleDisconnect} />
        ) : (
          <Button title="Connect Wearable" onPress={handleConnect} />
        )}
      </Card>

      <Card>
        <Label>Push activity</Label>
        <View style={{height: 8}} />
        <Button title="AutoFill from Health" onPress={handleAutoFill} />
        <View style={{height: 12}} />
        <TextInput
          value={stepsInput}
          onChangeText={setStepsInput}
          placeholder="Steps"
          placeholderTextColor={c.zinc}
          keyboardType="numeric"
          style={{
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: c.borderStrong,
            borderRadius: c.radius,
            paddingHorizontal: 14,
            paddingVertical: 12,
            color: c.foreground,
            backgroundColor: c.cardElevated,
            marginBottom: 10,
          }}
        />
        <TextInput
          value={kcalInput}
          onChangeText={setKcalInput}
          placeholder="Active Kcal"
          placeholderTextColor={c.zinc}
          keyboardType="numeric"
          style={{
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: c.borderStrong,
            borderRadius: c.radius,
            paddingHorizontal: 14,
            paddingVertical: 12,
            color: c.foreground,
            backgroundColor: c.cardElevated,
            marginBottom: 14,
          }}
        />
        {!isConnected ? (
          <>
            <Text
              style={{
                color: c.destructive,
                fontFamily: 'Inter_500Medium',
                fontSize: 12,
                lineHeight: 18,
              }}>
              Connect {providerLabel(provider)} first to push activity safely.
            </Text>
            <View style={{height: 10}} />
          </>
        ) : (
          <>
            <Text
              style={{
                color: c.mutedForeground,
                fontFamily: 'Inter_400Regular',
                fontSize: 12,
                lineHeight: 18,
              }}>
              Ready to sync from {providerLabel(provider)}.
            </Text>
            <View style={{height: 10}} />
          </>
        )}
        <Button
          title={isConnected ? 'Sync to Tanmatra' : 'Connect first'}
          onPress={handleSync}
        />
      </Card>

      <Card>
        <Label>Account</Label>
        <View style={{height: 10}} />
        <Button title="Sign out" onPress={handleSignOut} />
      </Card>
    </ScrollView>
  );
}
