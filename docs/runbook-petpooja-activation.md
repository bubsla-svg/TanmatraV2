# Runbook — Activating the Petpooja POS integration

The Petpooja integration (outbound order-push + authenticated inbound webhooks)
is **already built and merged**. It stays inert until its four required
`PETPOOJA_*` env vars are present on the `wellness-foods` Cloud Run service, then
activates automatically on the next deploy.

`deploy.yml` wires those four vars into the api-server deploy step:

- **Sensitive (Secret Manager, `--set-secrets`):** `PETPOOJA_APP_KEY`,
  `PETPOOJA_APP_SECRET`, `PETPOOJA_ACCESS_TOKEN`
- **Non-secret (inlined literal, `--update-env-vars`):** `PETPOOJA_RESTAURANT_ID`
  is already set to the restaurant's ID directly in `deploy.yml` (like
  `ALLOWED_ORIGINS`), so the only remaining prerequisite is the three secrets.

> **Order matters.** `gcloud run deploy --set-secrets` **fails the whole deploy**
> if a referenced secret doesn't exist. Do step 1–2 (create the secrets, grant
> IAM) **before** the deploy runs — i.e. before merging the PR. The restaurant
> ID is already inlined, so the three secrets are the only gate; until they
> exist and are readable the integration stays off (`petpoojaConfig()` requires
> all four).

All commands assume `GCP_PROJECT=brand-tanmatra-tmg`, `GCP_REGION=asia-south2`,
`SERVICE=wellness-foods` (from `deploy.yml`).

---

## 1. Create the three Secret Manager secrets

Paste each value at the prompt (or pipe from a file) — never inline in shell
history.

```bash
printf '%s' 'PASTE_APP_KEY'      | gcloud secrets create brand-tanmatra-petpooja-app-key      --project brand-tanmatra-tmg --replication-policy=automatic --data-file=-
printf '%s' 'PASTE_APP_SECRET'   | gcloud secrets create brand-tanmatra-petpooja-app-secret   --project brand-tanmatra-tmg --replication-policy=automatic --data-file=-
printf '%s' 'PASTE_ACCESS_TOKEN' | gcloud secrets create brand-tanmatra-petpooja-access-token --project brand-tanmatra-tmg --replication-policy=automatic --data-file=-
```

To rotate later, add a new version (the deploy pins `:latest`):

```bash
printf '%s' 'NEW_VALUE' | gcloud secrets versions add brand-tanmatra-petpooja-app-secret --project brand-tanmatra-tmg --data-file=-
```

## 2. Grant the runtime service account read access

Find the service account the Cloud Run service runs as:

```bash
RUNTIME_SA=$(gcloud run services describe wellness-foods \
  --region asia-south2 --project brand-tanmatra-tmg \
  --format='value(spec.template.spec.serviceAccountName)')
echo "$RUNTIME_SA"   # e.g. 475157072474-compute@developer.gserviceaccount.com
```

Grant `secretAccessor` on each new secret (same SA that already reads
`brand-tanmatra-database-url`):

```bash
for S in brand-tanmatra-petpooja-app-key brand-tanmatra-petpooja-app-secret brand-tanmatra-petpooja-access-token; do
  gcloud secrets add-iam-policy-binding "$S" \
    --project brand-tanmatra-tmg \
    --member="serviceAccount:${RUNTIME_SA}" \
    --role="roles/secretmanager.secretAccessor"
done
```

## 3. Identifiers — already inlined (and they are NOT interchangeable)

Petpooja issued **two** distinct non-secret identifiers for this outlet. Both are
set as literals in `deploy.yml`'s `--update-env-vars`; no action needed.

| Env var | Value | Used by |
|---|---|---|
| `PETPOOJA_RESTAURANT_ID` | `cq5hnj3629` | ordering integration — `restID` in the Save Order payload |
| `PETPOOJA_MENU_SHARING_CODE` | `cq5hnj3629` | menu fetch/serialization |
| `PETPOOJA_INVENTORY_RID` | `355738` | Inventory API (different host — see §4) |

`PETPOOJA_MENU_SHARING_CODE` is now **pinned explicitly**. `petpoojaConfig()` still
falls back to `restId` when it is unset (`petpoojaClient.ts:46`), and that fallback
silently coupled the two identifiers — correcting one would have moved the other.
Pinning it decouples them, so `PETPOOJA_RESTAURANT_ID` can be changed on its own.

> ⚠ **Open question with Petpooja.** Now that a distinct RID (`355738`) is known to
> exist, confirm which value **Save Order** expects in `restID`. We currently send
> the sharing code. If the POS wants the RID, outbound order pushes are being
> misrouted — and it fails *silently*: nothing in the repo asserts on the POS
> response body. Fixing it is a one-value edit here once Petpooja answers.

## 4. (Optional) Non-default endpoints

Only if Petpooja gave you values different from the code defaults:

- `PETPOOJA_SAVE_ORDER_URL` — defaults to `https://pos.petpooja.com/api/v1/save_order`
- `PETPOOJA_RESTAURANT_NAME` — defaults to `Wellness Foods`
- `PETPOOJA_INVENTORY_BASE_URL` — defaults to `https://api.petpooja.com`.
  **Leave it blank.** Petpooja's integration mail names
  `https://inventory.petpooja.com`, and that host is real — but it hosts the
  *write* side of the Inventory API (`/inventories/purchase_save_api` and
  friends, which push data INTO Petpooja). Everything this codebase reads lives
  on `api.petpooja.com`: `/V1/thirdparty/get_purchase/` and
  `/V1/thirdparty/get_stock_api/`, both verified against the live outlet on
  2026-07-25. Pointing the read client at the write host would 404.

  > An earlier revision of this runbook said `inventory.petpooja.com` "404s
  > every API path". That was a wrong inference from testing it with
  > `api.petpooja.com`'s paths. The advice — leave the variable blank — happens
  > to be unchanged; the reasoning was not sound, and is corrected here so the
  > next person does not conclude the vendor's mail was mistaken.
- `PETPOOJA_INVENTORY_REST_ID` — defaults to the menu sharing code. Leave blank.
  The Inventory API rejects the numeric RID with code 103 ("error in restaurant
  mapping"), so the RID is never the value here despite being the number
  Petpooja quotes for inventory.

Add these as literal lines in `deploy.yml`'s `--update-env-vars` (they're
non-secret), the same way `PETPOOJA_RESTAURANT_ID` is inlined. None are required
to activate.

## 5. Merge the deploy.yml PR

Merging to `main` re-runs the `Deploy` workflow (the `cloud-run` job triggers on
`.github/workflows/deploy.yml` changes), which rolls a new revision carrying the
four vars. With steps 1–2 done (secrets + IAM), the deploy succeeds and the
integration flips on.

---

## Verify

1. **Activation** — the new revision logs `petpooja: configured` on boot
   (from `validateEnv`). `petpooja: off` means one of the four didn't land.
   ```bash
   gcloud run services logs read wellness-foods --region asia-south2 \
     --project brand-tanmatra-tmg --limit 200 | grep -i petpooja
   ```
2. **Outbound** — place one real order through checkout; after payment verify,
   look for `petpooja order pushed` in logs and confirm it appears on the
   POS/kitchen display.
3. **Inbound** — have Petpooja fire a test order-status webhook; confirm it
   `200`s and the order status updates. A request with a blank/wrong key must
   `401`.

## Hand these webhook URLs to Petpooja

On the deployed base URL (`https://<service-url>` or `https://tanmatra.food`'s
API origin), all authenticated by the same app key/secret:

| Purpose | Path |
|---|---|
| Order push | `/integrations/petpooja/saveorder` |
| Order status | `/integrations/petpooja/orderstatus` |
| Order callback | `/integrations/petpooja/callback` |
| Rider info | `/integrations/petpooja/rider-info` |
| Stock on / off | `/integrations/petpooja/item_stock`, `/item_stock_off` |
| Store status get / update | `/integrations/petpooja/get_store_status`, `/update_store_status` |
| Menu fetch / push | `/integrations/petpooja/fetchmenu`, `/push-menu` |

## Known follow-up (Cloud Run multi-replica)

Store on/off status (`get_store_status` / `update_store_status`) is held
**in-memory per instance** (`petpoojaClient.ts`). Under horizontal autoscaling
the replicas can disagree. For go-live either pin the service to a single
instance (`--min-instances=1 --max-instances=1`) or land a durable `store_status`
DB table as the fix.
