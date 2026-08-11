import json

with open('docs/stitch/stitch-screen-manifest.json', 'r') as f:
    data = json.load(f)

for item in data:
    if item.get('promptId') == '5.5' or item.get('stitchScreenId') == '5.5' or item.get('promptId') == 'MOB-12-Dish-PDP-Dark':
        print("Modifying 5.5")
        item['canonicalRoute'] = '/menu/[productSlug]'
        item['routeEntryPoint'] = 'artifacts/storefront/app/(focus)/menu/[productSlug]/page.tsx'
    if item.get('promptId') == '12.2' or item.get('stitchScreenId') == '12.2' or item.get('canonicalRoute') == '/corporate-wellness':
        print("Modifying 12.2")
        item['canonicalRoute'] = '/corporate'
        item['routeEntryPoint'] = 'artifacts/storefront/app/(b2b)/corporate/page.tsx'
    # Also 5.5 by ID if promptId is something else
    if item.get('promptId') == '5.5':
        item['canonicalRoute'] = '/menu/[productSlug]'
        item['routeEntryPoint'] = 'artifacts/storefront/app/(focus)/menu/[productSlug]/page.tsx'

with open('docs/stitch/stitch-screen-manifest.json', 'w') as f:
    json.dump(data, f, indent=2)
