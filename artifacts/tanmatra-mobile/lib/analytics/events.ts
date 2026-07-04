export type BaseEvent = {
  ts: string;
  screen: 'pairing' | 'home';
  provider: 'apple_health' | 'health_connect' | 'unknown';
  platform: 'ios' | 'android' | 'web' | 'unknown';
};

export type EventMap = {
  pairing_view: BaseEvent;
  pairing_success: BaseEvent;
  pairing_invalid_token: BaseEvent & {length: number};
  wearable_connect_clicked: BaseEvent;
  wearable_connected: BaseEvent;
  wearable_connect_failed: BaseEvent & {message: string};
  wearable_disconnected: BaseEvent;
  wearable_disconnect_failed: BaseEvent & {message: string};
  activity_sync_attempted: BaseEvent & {steps: number; activityKcal: number};
  activity_sync_success: BaseEvent & {steps: number; activityKcal: number};
  activity_sync_failed: BaseEvent & {message: string};
  autofill_clicked: BaseEvent;
  autofill_unavailable: BaseEvent;
  signout_clicked: BaseEvent;
  signout_confirmed: BaseEvent;
};

export type EventName = keyof EventMap;
