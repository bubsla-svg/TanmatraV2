import fs from 'fs';
import path from 'path';

const appDir = 'artifacts/storefront/app';
const compDir = 'artifacts/storefront/components';
const quarantineApp = 'artifacts/storefront/quarantine/app';
const quarantineComp = 'artifacts/storefront/quarantine/components';

fs.mkdirSync(quarantineApp, { recursive: true });
fs.mkdirSync(quarantineComp, { recursive: true });

// 1. Quarantine App Routes
const keepAppDirs = ['api', 'menu']; // We already rewrote menu and page.tsx is a file
const appFiles = fs.readdirSync(appDir);
for (const item of appFiles) {
  const fullPath = path.join(appDir, item);
  if (fs.statSync(fullPath).isDirectory()) {
    if (!keepAppDirs.includes(item)) {
      console.log(`Quarantining app route: ${item}`);
      fs.renameSync(fullPath, path.join(quarantineApp, item));
    }
  }
}

// 2. Quarantine Components
const keepCompDirs = ['ui', 'primitives', 'cart', 'auth', 'landing', 'menu', 'quarantine'];
const compFiles = fs.readdirSync(compDir);
for (const item of compFiles) {
  const fullPath = path.join(compDir, item);
  if (fs.statSync(fullPath).isDirectory()) {
    if (!keepCompDirs.includes(item)) {
      console.log(`Quarantining component domain: ${item}`);
      fs.renameSync(fullPath, path.join(quarantineComp, item));
    }
  }
}

// 3. Establish neutral placeholders for every approved route
const approvedRoutes = [
  '/',
  '/menu',
  '/dish/[slug]',
  '/marketplace',
  '/marketplace/[slug]',
  '/meal-deals',
  '/meal-recommendations',
  '/meal-guides/[dishSlug]',
  '/recipes',
  '/plans',
  '/plan/[planId]',
  '/trial',
  '/custom-build',
  '/quick-setup',
  '/meal-planner',
  '/metabolic',
  '/performance',
  '/clinical',
  '/care/[condition]',
  '/account',
  '/account/orders',
  '/account/subscriptions',
  '/account/appointments',
  '/account/billing',
  '/account/addresses',
  '/account/preferences',
  '/account/favorites',
  '/account/history',
  '/account/symptoms',
  '/account/wellness',
  '/account/loyalty',
  '/account/connections',
  '/vouchers',
  '/premium',
  '/coach',
  '/rd',
  '/qa',
  '/checkout',
  '/order/confirmed/[orderId]',
  '/group/[code]',
  '/office-lunch/[id]',
  '/corporate',
  '/corporate/[slug]',
  '/corporate/[slug]/lunch-planner',
  '/corporate/invite/[token]',
  '/corporate-wellness',
  '/rd-partners',
  '/partners/dietitians',
  '/partners/gyms',
  '/partners/fitness-clubs',
  '/challenges',
  '/challenges/[slug]',
  '/challenges/tracker',
  '/team'
];

for (const route of approvedRoutes) {
  if (route === '/' || route === '/menu') continue; // Already implemented
  
  const routePath = path.join(appDir, route.substring(1));
  fs.mkdirSync(routePath, { recursive: true });
  
  const pagePath = path.join(routePath, 'page.tsx');
  if (!fs.existsSync(pagePath)) {
    console.log(`Creating placeholder for approved route: ${route}`);
    
    // Determine layout mapping based on 7.2 FocusLayout and 7.3 B2BLayout
    const isFocus = [
      '/dish/[slug]', '/marketplace/[slug]', '/plan/[planId]', '/trial', 
      '/custom-build', '/quick-setup', '/checkout', '/order/confirmed/[orderId]', 
      '/group/[code]', '/office-lunch/[id]', '/corporate/invite/[token]'
    ].includes(route);
    
    const isB2B = route.startsWith('/corporate') || route.startsWith('/partners') || route === '/rd-partners';
    
    const title = route.split('/').pop()?.toUpperCase() || 'ROUTE';
    
    const content = `import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "${title} | Tanmatra",
};

export default function PlaceholderPage() {
  return (
    <div className="min-h-dvh flex items-center justify-center p-6 bg-surface-canvas text-ink-primary">
      <div className="text-center">
        <div className="font-label-caps text-[10px] text-primary uppercase tracking-widest mb-4">
          ${isFocus ? 'Focus Layout' : (isB2B ? 'B2B Layout' : 'Global Layout')}
        </div>
        <h1 className="font-headline-md text-2xl mb-2">${route}</h1>
        <p className="text-sm text-ink-secondary">Clean slate placeholder pending implementation.</p>
      </div>
    </div>
  );
}
`;
    fs.writeFileSync(pagePath, content);
  }
}

console.log('P0 Global Apply complete.');
