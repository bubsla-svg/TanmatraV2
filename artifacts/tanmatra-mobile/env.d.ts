declare module 'react' {
  export function useState<S>(
    initialState: S | (() => S),
  ): [S, (newState: S | ((prevState: S) => S)) => void];
  export function useEffect(
    effect: () => void | (() => void),
    deps?: any[],
  ): void;
  export function useCallback<T extends (...args: any[]) => any>(
    callback: T,
    deps: any[],
  ): T;
  export function useMemo<T>(factory: () => T, deps: any[] | undefined): T;
  const React: any;
  export default React;
}

declare namespace React {
  type FC<P = {}> = (props: P) => any;
  type FormEvent = any;
  type ReactNode = any;
}

declare module 'react/jsx-runtime' {
  export const jsx: any;
  export const jsxs: any;
  export const Fragment: any;
}

declare namespace JSX {
  interface IntrinsicElements {
    [elemName: string]: any;
  }
}

declare const process: {
  env: Record<string, string | undefined>;
};

declare module 'react-native' {
  export const Platform: {OS: 'ios' | 'android' | 'web' | 'windows' | 'macos'};
  export const Alert: {
    alert(title: string, message?: string, buttons?: any[]): void;
  };
  export const View: any;
  export const Text: any;
  export const TextInput: any;
  export const Button: any;
  export const Pressable: any;
  export const RefreshControl: any;
  export const ScrollView: any;
  export const StyleSheet: {hairlineWidth: number; create(styles: any): any};
}

declare module 'expo-haptics' {
  export enum NotificationFeedbackType {
    Success,
    Warning,
    Error,
  }
  export enum ImpactFeedbackStyle {
    Light,
    Medium,
    Heavy,
  }
  export function notificationAsync(
    type: NotificationFeedbackType,
  ): Promise<void>;
  export function impactAsync(style: ImpactFeedbackStyle): Promise<void>;
}

declare module '@expo-google-fonts/inter' {
  export const Inter_400Regular: any;
  export const Inter_500Medium: any;
  export const Inter_600SemiBold: any;
  export const Inter_700Bold: any;
  export function useFonts(map: any): [boolean, Error | null];
}

declare module '@tanstack/react-query' {
  export class QueryClient {
    constructor(config?: any);
  }
  export const QueryClientProvider: any;
}

declare module 'expo-router' {
  export const Stack: any;
  export const Link: any;
}

declare module 'expo-splash-screen' {
  export function preventAutoHideAsync(): Promise<void>;
  export function hideAsync(): Promise<void>;
}

declare module 'expo-status-bar' {
  export const StatusBar: any;
}

declare module 'react-native-gesture-handler' {
  export const GestureHandlerRootView: any;
}

declare module 'react-native-keyboard-controller' {
  export const KeyboardProvider: any;
}

declare module 'react-native-safe-area-context' {
  export const SafeAreaProvider: any;
}

declare module '@workspace/api-client-react' {
  export function setBaseUrl(url: string): void;
  export function setAuthTokenGetter(fn: () => Promise<string | null>): void;
}
