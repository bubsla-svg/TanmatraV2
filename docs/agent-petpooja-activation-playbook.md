# Agent Playbook — Activate the Petpooja POS integration on Cloud Run

**Audience:** an autonomous engineering agent with `gcloud` access to the
`brand-tanmatra-tmg` GCP project and push/merge rights on
`chan8822/Wellness-Foods`. Follow this literally, top to bottom. The integration
code is already built and merged; your job is to supply its four env vars,
deploy, and verify — **not** to change application code.

Companion (human) doc: `docs/runbook-petpooja-activation.md`. This playbook is
self-contained; that doc is the same procedure for a human operator.

---

## 0. What "done" means (definition of done)

All true, in order:

1. Secret Manager holds `brand-tanmatra-petpooja-app-key`, `-app-secret`,
   `-access-token`, each with a live version, readable by the Cloud Run runtime
   service account.
2. `PETPOOJA_RESTAURANT_ID` is inlined in `deploy.yml` (already done — no action).
3. PR #117 (the `deploy.yml` wiring) is merged **after** 1–2, and the resulting
   `Deploy` run is green.
4. The running revision logs `petpooja: configured` (not `off`).
5. One outbound test order reached Petpooja (`petpooja order pushed` in logs),
   and one inbound test webhook was accepted (200) with a bad-key request
   rejected (401).
6. The `/integrations/petpooja/*` webhook URLs have been handed to the Petpooja
   team (human/portal step — you surface them and confirm).

## 1. Operating rules (read before running anything)

- **Never print, log, echo, or commit a credential value.** Feed secrets to
  `gcloud` only via `printf '%s' "$ENVVAR" | gcloud ... --data-file=-`. Do not
  put values on the command line (they'd land in process listings / history).
- **Never commit the values to the repo.** They live only in Secret Manager and
  the GitHub variable store.
- **Idempotent:** assume you may re-run. Create-or-add-version for secrets;
  IAM bindings are naturally idempotent.
- **STOP and ask the operator** at every point marked 🛑 (outward-facing or
  ambiguous actions: merging the PR, non-default endpoints, single-instance
  pinning, registering webhooks in Petpooja's portal). Do not self-approve them.
- If any preflight check fails, **stop and report** — do not improvise around it.

## 2. Inputs the operator must provide (out-of-band, not in the repo)

Before you start, the operator exports the three secret credential values into
your shell environment (these names are used throughout — nothing sensitive is
written to disk). The non-secret restaurant ID is already inlined in
`deploy.yml`, so it is NOT an input here.

```bash
export PP_APP_KEY='…'          # Petpooja App Key
export PP_APP_SECRET='…'       # Petpooja App Secret
export PP_ACCESS_TOKEN='…'     # Petpooja Access Token
```

If any of these is empty, **stop and ask** — do not proceed with blanks (a blank
`--set-secrets` value fails the deploy).

```bash
for v in PP_APP_KEY PP_APP_SECRET PP_ACCESS_TOKEN; do
  [ -n "${!v}" ] || { echo "MISSING: $v — stop and ask the operator"; exit 1; }
done
echo "all three inputs present"
```

## 3. Preflight

```bash
# Fixed facts from deploy.yml
PROJECT=brand-tanmatra-tmg
REGION=asia-south2
SERVICE=wellness-foods
REPO=chan8822/Wellness-Foods

# a) gcloud is authenticated and pointed at the right project
gcloud config set project "$PROJECT"
gcloud auth list --filter=status:ACTIVE --format='value(account)' || { echo "not authenticated — stop"; exit 1; }

# b) the service exists and you can read it
gcloud run services describe "$SERVICE" --region "$REGION" --project "$PROJECT" \
  --format='value(status.url)' || { echo "cannot read service — stop"; exit 1; }

# c) resolve the runtime service account (needed for the IAM grant)
RUNTIME_SA=$(gcloud run services describe "$SERVICE" --region "$REGION" --project "$PROJECT" \
  --format='value(spec.template.spec.serviceAccountName)')
[ -n "$RUNTIME_SA" ] || RUNTIME_SA="$(gcloud projects describe "$PROJECT" --format='value(projectNumber)')-compute@developer.gserviceaccount.com"
echo "runtime SA: $RUNTIME_SA"

# d) repo checked out on the go-live branch (so you have deploy.yml + these docs)
git fetch origin claude/tanmatra-ux-clinical-audit-2nsutp
git checkout claude/tanmatra-ux-clinical-audit-2nsutp
git pull --ff-only origin claude/tanmatra-ux-clinical-audit-2nsutp
```

If (a)–(c) fail, the agent's environment isn't authenticated to GCP — stop and
tell the operator to run this from an environment with project access (Cloud
Shell, or CI with the deploy service-account key). Do not attempt to install or
authenticate an SDK using credentials pasted into a chat.

## 4. Create the three Secret Manager secrets (idempotent)

```bash
create_or_update_secret () {
  local name="$1" value="$2"
  if gcloud secrets describe "$name" --project "$PROJECT" >/dev/null 2>&1; then
    printf '%s' "$value" | gcloud secrets versions add "$name" --project "$PROJECT" --data-file=-
    echo "added new version: $name"
  else
    printf '%s' "$value" | gcloud secrets create "$name" --project "$PROJECT" \
      --replication-policy=automatic --data-file=-
    echo "created: $name"
  fi
}

create_or_update_secret brand-tanmatra-petpooja-app-key      "$PP_APP_KEY"
create_or_update_secret brand-tanmatra-petpooja-app-secret   "$PP_APP_SECRET"
create_or_update_secret brand-tanmatra-petpooja-access-token "$PP_ACCESS_TOKEN"
```

## 5. Grant the runtime service account read access

```bash
for S in brand-tanmatra-petpooja-app-key brand-tanmatra-petpooja-app-secret brand-tanmatra-petpooja-access-token; do
  gcloud secrets add-iam-policy-binding "$S" \
    --project "$PROJECT" \
    --member="serviceAccount:${RUNTIME_SA}" \
    --role="roles/secretmanager.secretAccessor"
done
```

Verify each secret resolves for that SA (optional sanity check):

```bash
for S in brand-tanmatra-petpooja-app-key brand-tanmatra-petpooja-app-secret brand-tanmatra-petpooja-access-token; do
  gcloud secrets get-iam-policy "$S" --project "$PROJECT" --format='value(bindings.members)' | grep -q "$RUNTIME_SA" \
    && echo "OK  $S" || echo "MISSING BINDING  $S"
done
```

## 6. Restaurant ID — already inlined (no action)

`PETPOOJA_RESTAURANT_ID` is a non-secret identifier and is already set as a
literal in `deploy.yml`'s `--update-env-vars`. Nothing to do. To change it
later, edit that one value in `deploy.yml`.

## 7. 🛑 Optional non-default endpoints — ask before adding

The code defaults are correct for a standard Petpooja tenant. Only if the
Petpooja team specified something different:

- `PETPOOJA_SAVE_ORDER_URL` (default `https://pos.petpooja.com/api/v1/save_order`)
- `PETPOOJA_MENU_SHARING_CODE` (default = restaurant ID)
- `PETPOOJA_RESTAURANT_NAME` (default `Wellness Foods`)

If any differ, **stop and ask the operator**, then add each as a literal line in
`deploy.yml`'s `--update-env-vars` (they're non-secret) — mirroring how
`PETPOOJA_RESTAURANT_ID` is inlined. Do not guess values.

## 8. 🛑 Merge PR #117 → triggers the activating deploy

Only once §4–§6 are confirmed green. Merging re-runs the `Deploy` workflow
(`.github/workflows/deploy.yml` is in the `cloud-run` job's path filter), which
rolls a new revision carrying the four vars.

- Confirm the PR's CI is green and there are no unaddressed review comments.
- **Ask the operator for explicit go** to merge (production deploy).
- Merge (squash), then watch the `Deploy` workflow to completion.

If the deploy **fails**, see Troubleshooting (§11) — almost always a missing
secret or IAM binding from §4–§5.

## 9. Verify activation

```bash
# a) configured, not off
gcloud run services logs read "$SERVICE" --region "$REGION" --project "$PROJECT" --limit 300 \
  | grep -i petpooja
# expect a line containing: petpooja: configured

# b) service URL for the webhook handoff
gcloud run services describe "$SERVICE" --region "$REGION" --project "$PROJECT" --format='value(status.url)'
```

- **Outbound:** place one real order through checkout; after payment verify,
  confirm `petpooja order pushed` in logs and that it appears on the POS/kitchen
  display.
- **Inbound:** have Petpooja fire a test `orderstatus` webhook; confirm 200 and
  the order status updates. A request with a blank/wrong `app_key`/`app_secret`
  must return 401.

## 10. 🛑 Hand the webhook URLs to Petpooja (portal/human step)

On the service base URL from §9b (or the `tanmatra.food` API origin), all
authenticated by the same app key/secret. Surface this list to the operator /
Petpooja team; you cannot configure Petpooja's side yourself.

| Purpose | Path |
|---|---|
| Order push | `/integrations/petpooja/saveorder` |
| Order status | `/integrations/petpooja/orderstatus` |
| Order callback | `/integrations/petpooja/callback` |
| Rider info | `/integrations/petpooja/rider-info` |
| Stock on / off | `/integrations/petpooja/item_stock`, `/item_stock_off` |
| Store status get / update | `/integrations/petpooja/get_store_status`, `/update_store_status` |
| Menu fetch / push | `/integrations/petpooja/fetchmenu`, `/push-menu` |

## 11. 🛑 Multi-replica store status — decide with the operator

`get_store_status`/`update_store_status` state is held **in-memory per instance**
(`artifacts/api-server/src/lib/petpoojaClient.ts`). Under horizontal autoscaling
replicas can disagree. For go-live, ask the operator to pick one:

- **Quick:** pin the service — add `--min-instances=1 --max-instances=1` to the
  `cloud-run` deploy step (a `deploy.yml` change; single-concern PR).
- **Proper:** implement a durable `store_status` DB table (schema + read/write in
  `petpoojaClient.ts`). Larger; separate PR.

Do not pick unilaterally — it's a capacity/cost trade-off.

## 12. Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `Deploy` fails: `Secret … was not found` / permission denied | §4 secret missing or §5 IAM not granted | Complete §4–§5, re-run the deploy (`workflow_dispatch` on `Deploy`, or push an empty commit) |
| Logs show `petpooja: off` after a green deploy | One of the four vars didn't land | Check all three secrets have a version + binding, and `PETPOOJA_RESTAURANT_ID` is present in `deploy.yml`'s `--update-env-vars`; redeploy |
| Inbound webhook returns 401 for a legit Petpooja call | Petpooja sending a different key/secret than stored | Reconcile the values in Secret Manager with what Petpooja has for this restaurant; `versions add` the correct ones |
| Outbound never pushes | `petpooja: off`, or the order path didn't reach payment-verify | Confirm activation first; outbound fires from the payment webhook in `routes/payments.ts` |

## Guardrails — do NOT

- Do not edit application code to "make it work" — activation is pure config.
- Do not weaken inbound auth or the strict/lenient guards in `petpoojaClient.ts`.
- Do not put any credential value in `deploy.yml`, a repo variable used for
  secrets, a commit, a PR comment, or logs.
- Do not merge PR #117 before §4–§6 are green (the deploy will fail).
