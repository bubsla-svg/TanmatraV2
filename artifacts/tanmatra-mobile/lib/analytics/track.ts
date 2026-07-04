import {Platform} from 'react-native';
import type {EventMap, EventName} from './events';

function nowIso() {
  return new Date().toISOString();
}

function normalizePlatform(): 'ios' | 'android' | 'web' | 'unknown' {
  if (Platform.OS === 'ios') return 'ios';
  if (Platform.OS === 'android') return 'android';
  if (Platform.OS === 'web') return 'web';
  return 'unknown';
}

export function createBaseEvent(input: {
  screen: 'pairing' | 'home';
  provider: 'apple_health' | 'health_connect' | 'unknown';
}) {
  return {
    ts: nowIso(),
    screen: input.screen,
    provider: input.provider,
    platform: normalizePlatform(),
  } as const;
}

// Minimal logger; swap to Segment/PostHog later.
export function trackEvent<K extends EventName>(name: K, payload: EventMap[K]) {
  // eslint-disable-next-line no-console
  console.info('[analytics]', name, payload);
}
