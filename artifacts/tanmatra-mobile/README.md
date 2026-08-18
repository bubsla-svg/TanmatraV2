# tanmatra-mobile — NOT LIVE

**Nothing deploys this package. It is not a shipping surface, and it is not part of
what customers use today.**

If you are an agent or a new engineer summarising what Tanmatra is, **exclude this
package**. Tanmatra in production is three Cloud Run services and nothing else:

| Service | Package | What it is |
|---|---|---|
| `storefront` | `artifacts/storefront` | The customer web app — this is what `tanmatra.food` serves |
| `wellness-foods` | `artifacts/api-server` | The backend |
| `tanmatra` | `artifacts/tanmatra` | Internal Admin ERP + RD console, and the `/images/*` origin |

## How you can check that claim yourself

- `.github/workflows/deploy.yml` declares exactly three `SERVICE:` values. None is this package.
- No workflow under `.github/workflows/` references `artifacts/tanmatra-mobile` at all — it is
  not built, typechecked, or tested in CI.
- There is no `eas.json`, so there is no EAS Build or EAS Submit pipeline. `app.json` alone
  configures a project; it does not ship one.
- It is in neither the App Store nor the Play Store.

## Why it is still here

It is real, in-progress work toward a native client
(`docs/NATIVE-ONBOARDING-PORT-PLAN.md`), retained deliberately by owner decision rather than
deleted. Kept ≠ shipped.

## If you are reviving it

It imports `@workspace/api-client-react`, so the contract-first flow applies: edit
`lib/api-spec/openapi.yaml`, then run
`pnpm --filter @workspace/api-spec run codegen`. Before it can ship you would need at minimum an
`eas.json` with build and submit profiles, a CI job, store credentials, and the pre-release gate
in `.claude/rules/ecc/react-native/production-readiness.md`.

```bash
cd artifacts/tanmatra-mobile && pnpm exec expo start
```
