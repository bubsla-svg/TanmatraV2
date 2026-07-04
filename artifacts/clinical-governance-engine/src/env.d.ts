declare module 'crypto' {
  export function createHmac(algorithm: string, key: string): any;
  export function timingSafeEqual(a: any, b: any): boolean;
  export function randomBytes(size: number): {
    toString(encoding: string): string;
  };
}

declare const process: {
  env: Record<string, string | undefined>;
};

declare const Buffer: {
  from(str: string, encoding?: string): any;
};

declare const console: {
  log(...args: any[]): void;
  error(...args: any[]): void;
};
