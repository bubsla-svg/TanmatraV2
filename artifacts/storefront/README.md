# @workspace/storefront

The rebuild storefront — Next.js App Router, server-first. **Phase 1 skeleton:**
layout shell + server-rendered menu from the live catalog API. **No money path.**

## Run
```bash
pnpm --filter @workspace/storefront run dev      # http://localhost:3000
pnpm --filter @workspace/storefront run build
```
Point at the API with `API_BASE_URL` (defaults to `http://localhost:3000`); the
menu falls back to `@workspace/menu-catalog` when the API is unreachable.

## Anti-rot gates (CI from commit one)
- `pnpm --filter @workspace/storefront run typecheck`
- `pnpm --filter @workspace/storefront run lint:filecap` — no file >300 lines,
  no component (.tsx) >150, every `"use client"` justified.

## Conventions
- **Server components by default.** Add `"use client"` only with a one-line
  justification comment (the file-cap gate enforces it).
- Tokens come from `@workspace/tokens`; **no raw colours** — use the mapped
  Tailwind utilities (`bg-bg`, `text-ink`, `bg-gold`, …). Light theme is the
  server default and resolves before first paint.
