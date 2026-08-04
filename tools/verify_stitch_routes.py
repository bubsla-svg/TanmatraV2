#!/usr/bin/env python3
"""
verify_stitch_routes.py — Audit & verify that all Google Stitch generated screens
in project 12062470764535558612 ("Tanmatra — Premium Clinical Metabolic OS")
are properly wired to corresponding Next.js App Router routes in artifacts/storefront.
"""

import os
import sys
import re

STOREFRONT_APP_DIR = os.path.join(os.path.dirname(__file__), "../artifacts/storefront/app")
STITCH_ROUTES_TS = os.path.join(os.path.dirname(__file__), "../artifacts/storefront/lib/stitchRoutes.ts")

# 16 canonical screens generated in Stitch project 12062470764535558612 per Tanmatra Google Stitch.md
WIRED_SCREENS = [
    {"screenId": "839f4a92436a4444bda6fabfa07d7a06", "title": "Tanmatra Design Reference", "route": "/styleguide?theme=dark", "path": "styleguide/page.tsx"},
    {"screenId": "f814ddb11cbb4b17832dba069604e371", "title": "Tanmatra Design Reference (Light Theme)", "route": "/styleguide?theme=light", "path": "styleguide/page.tsx"},
    {"screenId": "966d396f55ed43ada3e69ff56950d3ef", "title": "Tanmatra Home: Clinical Feed", "route": "/", "path": "page.tsx"},
    {"screenId": "72d14e82a0064eb398552c2bee5d4682", "title": "Daily Menu: Clinical Selection", "route": "/menu", "path": "menu/page.tsx"},
    {"screenId": "ef20a9487d414d8aaa48ab69e4b1f22d", "title": "Dish Detail: Charcoal Smoothie", "route": "/dish/[slug]", "path": "dish/[slug]/page.tsx"},
    {"screenId": "44267f5a1c8c43f0873fb5ed30fef65d", "title": "Cart Drawer: Clinical Summary", "route": "/checkout#cart-drawer", "path": "checkout/page.tsx"},
    {"screenId": "866fc4167d9c47709ff6c3465ab63b84", "title": "Tanmatra Marketplace: Clinical Pantry", "route": "/marketplace", "path": "marketplace/page.tsx"},
    {"screenId": "8d3c8980a3cc4937b00e062e5d5e554c", "title": "Subscription Plans: Therapeutic Protocols", "route": "/plans", "path": "plans/page.tsx"},
    {"screenId": "e4be16728fa3442d88c96a63529b1b92", "title": "Plan Configuration: 5-Day Metabolic Reset", "route": "/plan/[planId]", "path": "plan/[planId]/page.tsx"},
    {"screenId": "21ee21b9d8e94c98927f921775b8c5f3", "title": "Build Your Own Plan: Goal Selection", "route": "/custom-build", "path": "custom-build/page.tsx"},
    {"screenId": "b4f7b93cf4854f5eac4e1afb72efff6f", "title": "Secure Checkout: Tanmatra OS", "route": "/checkout", "path": "checkout/page.tsx"},
    {"screenId": "59aa3123733a4aac84001db8d6032283", "title": "3-Day Clinical Trial Protocol", "route": "/trial", "path": "trial/page.tsx"},
    {"screenId": "75cf7ca6e32c4596b20c9ef59e0d9f16", "title": "Meal Planner: Clinical Protocol Active", "route": "/meal-planner", "path": "meal-planner/page.tsx"},
    {"screenId": "f49ace3e5e27464aacca6184b0432059", "title": "Account Hub: Clinical Profile", "route": "/account", "path": "account/page.tsx"},
    {"screenId": "2b29b0174cfb46b1826594928710885e", "title": "Biometric & CGM Telemetry: Live Sync", "route": "/account/wearables", "path": "account/wearables/page.tsx"},
    {"screenId": "43952f75a4c649be9f2e947d011b6bc0", "title": "Clinical Care: Metabolic Protocols", "route": "/care", "path": "care/page.tsx"}
]

def verify():
    print("=== TANMATRA GOOGLE STITCH ROUTE-WIRING AUDIT ===")
    print(f"Checking {len(WIRED_SCREENS)} screens generated in project 12062470764535558612...")
    
    missing = 0
    for sc in WIRED_SCREENS:
        filepath = os.path.join(STOREFRONT_APP_DIR, sc["path"])
        if os.path.exists(filepath):
            status = "PASS"
        else:
            status = "FAIL (File missing)"
            missing += 1
        print(f"  [{status}] {sc['screenId'][:8]}... -> Route {sc['route']:25} ({sc['title']})")
    
    if not os.path.exists(STITCH_ROUTES_TS):
        print(f"ERROR: {STITCH_ROUTES_TS} not found.")
        sys.exit(1)
    
    content = open(STITCH_ROUTES_TS, "r", encoding="utf-8").read()
    if "STITCH_SCREEN_REGISTRY" not in content or "getStitchScreenForRoute" not in content:
        print("ERROR: STITCH_SCREEN_REGISTRY not exported in stitchRoutes.ts")
        sys.exit(1)
        
    if missing > 0:
        print(f"\nFAILED: {missing} route files were missing.")
        sys.exit(1)
    
    print(f"\nSUCCESS: All {len(WIRED_SCREENS)} Stitch screens are wired and verified with their corresponding App Router routes.")
    sys.exit(0)

if __name__ == "__main__":
    verify()
