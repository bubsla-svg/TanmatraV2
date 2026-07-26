/**
 * Single source of truth for build-time prerendered paths in the Ops ERP container.
 */

export const PUBLIC_PRERENDER_PATHS: string[] = [
  "/",
  "/admin",
  "/admin/login",
];

export const NOINDEX_SHELL_PATHS: string[] = [
  "/rd-console",
];

export const ALL_PRERENDER_PATHS: string[] = [
  ...PUBLIC_PRERENDER_PATHS,
  ...NOINDEX_SHELL_PATHS,
];
