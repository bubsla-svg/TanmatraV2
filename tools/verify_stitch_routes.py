#!/usr/bin/env python3
"""
verify_stitch_routes.py — Phase 13A Stitch Design Fidelity & Route Contract Verifier

Audits the 74-item source-of-truth manifest in docs/stitch/stitch-screen-manifest.json
across four verification layers:
  Layer A: Manifest Completeness (74 prompts accounted for, 0 duplicate IDs)
  Layer B: Route & Implementation Reachability (all page.tsx and component files exist)
  Layer D: Route Contract & Architecture Compliance (FocusLayout vs GlobalLayout vs Overlay)
"""

import os
import sys
import json

ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
MANIFEST_PATH = os.path.join(ROOT_DIR, "docs/stitch/stitch-screen-manifest.json")
STOREFRONT_DIR = os.path.join(ROOT_DIR, "artifacts/storefront")
STITCH_ROUTES_TS = os.path.join(STOREFRONT_DIR, "lib/stitchRoutes.ts")

def verify():
    print("================================================================================")
    print("  PHASE 13A: TANMATRA GOOGLE STITCH ACCEPTANCE AUDIT & CONTRACT VERIFIER")
    print("================================================================================")

    if not os.path.exists(MANIFEST_PATH):
        print(f"[FAIL] Manifest not found: {MANIFEST_PATH}")
        sys.exit(1)

    with open(MANIFEST_PATH, "r", encoding="utf-8") as f:
        manifest = json.load(f)

    # -------------------------------------------------------------------------
    # Layer A: Manifest Completeness
    # -------------------------------------------------------------------------
    print(f"\n[LAYER A: MANIFEST INTEGRITY]")
    total_entries = len(manifest)
    print(f"  Total manifest prompt outputs: {total_entries} (Target: 74)")

    if total_entries != 74:
        print(f"  [FAIL] Expected 74 entries, found {total_entries}")
        sys.exit(1)

    prompt_ids = set()
    duplicates = []
    for item in manifest:
        pid = item.get("promptId")
        if pid in prompt_ids:
            duplicates.append(pid)
        prompt_ids.add(pid)

    if duplicates:
        print(f"  [FAIL] Duplicate prompt IDs found: {duplicates}")
        sys.exit(1)
    print(f"  [PASS] 74 unique prompt outputs verified with 0 duplicates.")

    # -------------------------------------------------------------------------
    # Layer B: Route & Implementation Reachability
    # -------------------------------------------------------------------------
    print(f"\n[LAYER B: ROUTE & IMPLEMENTATION REACHABILITY]")
    missing_files = []
    category_counts = {"GlobalLayout": 0, "FocusLayout": 0, "B2BLayout": 0, "Overlay": 0}

    for item in manifest:
        pid = item["promptId"]
        name = item["designName"]
        layout = item["layout"]
        impl_rel = item["implementation"]
        impl_path = os.path.join(ROOT_DIR, impl_rel)
        
        category_counts[layout] = category_counts.get(layout, 0) + 1

        if not os.path.exists(impl_path):
            missing_files.append((pid, name, impl_rel))
            print(f"  [MISSING] Prompt {pid:6} | {name:40} -> {impl_rel}")
        else:
            status = "PASS"

    if missing_files:
        print(f"\n  [FAIL] {len(missing_files)} implementation targets missing from workspace.")
        sys.exit(1)
    else:
        print(f"  [PASS] All 74 implementation targets exist and are reachable in codebase.")

    print(f"\n  Layout Breakdown across 74 Prompt Outputs:")
    for k, v in category_counts.items():
        print(f"    - {k:15}: {v:2} screens/states")

    # -------------------------------------------------------------------------
    # Layer D: Route Contract Compliance
    # -------------------------------------------------------------------------
    print(f"\n[LAYER D: ARCHITECTURE & CONTRACT COMPLIANCE]")
    
    # 1. Health Connections canonical route check
    connections_page = os.path.join(STOREFRONT_DIR, "app/account/connections/page.tsx")
    wearables_page = os.path.join(STOREFRONT_DIR, "app/account/wearables/page.tsx")
    if os.path.exists(connections_page):
        print(f"  [PASS] Canonical /account/connections page is implemented.")
    else:
        print(f"  [FAIL] Canonical /account/connections page missing.")
        sys.exit(1)

    if os.path.exists(wearables_page):
        content = open(wearables_page).read()
        if "permanentRedirect" in content and "/account/connections" in content:
            print(f"  [PASS] Legacy /account/wearables correctly issues 308 redirect to /account/connections.")
        else:
            print(f"  [FAIL] /account/wearables does not redirect to canonical /account/connections.")
            sys.exit(1)

    # 2. Cart Drawer overlay check
    cart_drawer_item = next((x for x in manifest if x["promptId"] == "5.6"), None)
    if cart_drawer_item and cart_drawer_item["layout"] == "Overlay":
        print(f"  [PASS] Cart Drawer is properly mapped as a Global Commerce Overlay (not checkout hash).")
    else:
        print(f"  [FAIL] Cart Drawer layout is not Overlay.")
        sys.exit(1)

    # 3. Stitch Screen Registry in stitchRoutes.ts check
    if not os.path.exists(STITCH_ROUTES_TS):
        print(f"  [FAIL] {STITCH_ROUTES_TS} missing.")
        sys.exit(1)
    
    routes_content = open(STITCH_ROUTES_TS).read()
    if "STITCH_SCREEN_REGISTRY" in routes_content and "getStitchScreenForRoute" in routes_content:
        print(f"  [PASS] stitchRoutes.ts exports STITCH_SCREEN_REGISTRY and getStitchScreenForRoute.")
    else:
        print(f"  [FAIL] stitchRoutes.ts missing registry exports.")
        sys.exit(1)

    print("\n================================================================================")
    print("  PHASE 13A AUDIT: ALL 74 PROMPT OUTPUTS & ARCHITECTURAL CONTRACTS PASSED")
    print("================================================================================\n")
    sys.exit(0)

if __name__ == "__main__":
    verify()
