import type { DetailedHTMLProps, HTMLAttributes } from "react";

declare global {
  namespace JSX {
    interface IntrinsicElements {
      "gmpx-api-loader": DetailedHTMLProps<HTMLAttributes<HTMLElement> & { key?: string; "solution-channel"?: string }, HTMLElement>;
      "gmp-map": DetailedHTMLProps<HTMLAttributes<HTMLElement> & { center?: string; zoom?: string | number; "map-id"?: string }, HTMLElement>;
      "gmpx-place-picker": DetailedHTMLProps<HTMLAttributes<HTMLElement> & { placeholder?: string; value?: any }, HTMLElement>;
      "gmp-advanced-marker": DetailedHTMLProps<HTMLAttributes<HTMLElement> & { position?: any }, HTMLElement>;
    }
  }
}

declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      "gmpx-api-loader": DetailedHTMLProps<HTMLAttributes<HTMLElement> & { key?: string; "solution-channel"?: string }, HTMLElement>;
      "gmp-map": DetailedHTMLProps<HTMLAttributes<HTMLElement> & { center?: string; zoom?: string | number; "map-id"?: string }, HTMLElement>;
      "gmpx-place-picker": DetailedHTMLProps<HTMLAttributes<HTMLElement> & { placeholder?: string; value?: any }, HTMLElement>;
      "gmp-advanced-marker": DetailedHTMLProps<HTMLAttributes<HTMLElement> & { position?: any }, HTMLElement>;
    }
  }
}

declare module "react/jsx-runtime" {
  namespace JSX {
    interface IntrinsicElements {
      "gmpx-api-loader": DetailedHTMLProps<HTMLAttributes<HTMLElement> & { key?: string; "solution-channel"?: string }, HTMLElement>;
      "gmp-map": DetailedHTMLProps<HTMLAttributes<HTMLElement> & { center?: string; zoom?: string | number; "map-id"?: string }, HTMLElement>;
      "gmpx-place-picker": DetailedHTMLProps<HTMLAttributes<HTMLElement> & { placeholder?: string; value?: any }, HTMLElement>;
      "gmp-advanced-marker": DetailedHTMLProps<HTMLAttributes<HTMLElement> & { position?: any }, HTMLElement>;
    }
  }
}
