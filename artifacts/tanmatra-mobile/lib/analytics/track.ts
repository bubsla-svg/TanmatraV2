import {Platform} from 'react-native';
import {API_BASE} from '../activity';
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

/**
 * First-party tracker (playbook Part 8, A3). Beacons to the same
 * POST /events endpoint the web SPA uses — server-side Zod validation +
 * PII scrubbing already handle it, and the endpoint always answers 204.
 * `platform:"mobile"` overrides the OS-level platform from createBaseEvent
 * so warehouse queries can split web vs mobile with one prop; the OS is
 * preserved under `os`. Fire-and-forget: analytics must never surface
 * errors into the app, so every failure path is swallowed.
 */
export function trackEvent<K extends EventName>(name: K, payload: EventMap[K]) {
  if (__DEV__) {
    // eslint-disable-next-line no-console
    console.info('[analytics]', name, payload);
  }
  try {
    const {platform: os, ...rest} = payload as {platform?: string} & Record<
      string,
      unknown
    >;
    void fetch(`${API_BASE}/events`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        name,
        props: {...rest, ...(os ? {os} : {}), platform: 'mobile'},
      }),
    }).catch(() => {
      // Swallowed — no retry queue yet; dropped beacons are acceptable.
    });
  } catch {
    // fetch/JSON construction failure — never let analytics throw.
  }
}
