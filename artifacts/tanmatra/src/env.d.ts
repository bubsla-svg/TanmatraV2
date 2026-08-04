declare module 'crypto' {
  export function createHmac(algorithm: string, key: string): any;
  export function timingSafeEqual(a: any, b: any): boolean;
  export function randomBytes(size?: number): any;
}

declare const process: {
  env: Record<string, string | undefined>;
  exit(code?: number): void;
};

declare const Buffer: {
  from(str: string, encoding?: string): any;
};

declare const console: {
  log(...args: any[]): void;
  error(...args: any[]): void;
};
