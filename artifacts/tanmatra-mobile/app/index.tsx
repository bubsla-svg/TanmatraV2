import {createBaseEvent, trackEvent} from '@/lib/analytics/track';
import * as Haptics from 'expo-haptics';
import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {
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

const c = {
  background: '#09090b',
  foreground: '#fafafa',
  mutedForeground: '#a1a1aa',
  zinc: '#71717a',
  borderStrong: '#27272a',
  radius: 12,
  cardElevated: '#18181b',
  primary: '#10b981',
  destructive: '#ef4444',
};

const topPad = 10;
const bottomPad = 10;

function Card({children}: {children?: any}) {
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

function Label({children}: {children?: any}) {
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
  onPress: () => void;
  testID?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      testID={testID}
      style={{
        backgroundColor: c.primary,
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: c.radius,
        alignItems: 'center',
      }}>
      <Text
        style={{
          color: '#ffffff',
          fontFamily: 'Inter_600SemiBold',
          fontSize: 14,
        }}>
        {title}
      </Text>
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

function relativeTime(isoString?: string): string {
  if (!isoString) return 'just now';
  return '2 mins ago';
}

async function readTodayActivity(): Promise<{
  steps: number;
  activityKcal: number;
} | null> {
  return {steps: 8500, activityKcal: 420};
}

export default function HomeScreen() {
  const [token, setTokenState] = useState<string | null>(null);
  const [tokenReady, setTokenReady] = useState<boolean>(true);
  const [tokenInput, setTokenInput] = useState<string>('');
  const [stepsInput, setStepsInput] = useState<string>('');
  const [kcalInput, setKcalInput] = useState<string>('');
  const [showPairHelp, setShowPairHelp] = useState<boolean>(false);
  const [isConnected, setIsConnected] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  const wearableLink = useMemo(
    () => ({lastSyncedAt: new Date().toISOString()}),
    [],
  );

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
    setTokenState(newToken);
  }, []);

  const refreshAll = useCallback(async () => {
    setRefreshing(false);
  }, []);

  const queryClient = useMemo(() => ({clear: () => {}}), []);

  const connect = useMemo(
    () => ({
      mutateAsync: async (args: {data: {provider: string}}) => {
        setIsConnected(true);
        return {status: 'connected'};
      },
    }),
    [],
  );

  const disconnect = useMemo(
    () => ({
      mutateAsync: async (args: {data: {provider: string}}) => {
        setIsConnected(false);
        return {status: 'disconnected'};
      },
    }),
    [],
  );

  const sync = useMemo(
    () => ({
      mutateAsync: async (args: {
        data: {provider: string; activityKcal: number; steps: number};
      }) => {
        return {status: 'synced'};
      },
    }),
    [],
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
            await setToken(null);
            queryClient.clear();
          },
        },
      ],
    );
  }, [setToken, queryClient, providerForAnalytics]);

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
                  tanmatra.health/wellness#pair-device
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
            ? `Connected · Last sync ${relativeTime(wearableLink?.lastSyncedAt)}`
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
