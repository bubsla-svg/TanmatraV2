import { test, expect } from '@playwright/test';

test.describe('Tanmatra High-Velocity Storefront & Checkout Audit', () => {
  test.beforeEach(async ({ page }) => {
    page.on('console', msg => console.log('BROWSER LOG:', msg.text()));
    page.on('pageerror', err => console.log('BROWSER ERROR:', err));
    await page.addInitScript(() => {
      console.log("INIT SCRIPT RUNNING: Injecting E2E Mock Flags");
      window.localStorage.clear();
      (window as any).__E2E_MOCK_AUTH__ = true;
      (window as any).__E2E_MOCK_MAPS__ = true;
    });

    let isUserAuthenticated = false;

    // Stateful mock for saved addresses API
    await page.route('**/api/addresses', async (route) => {
      if (!isUserAuthenticated) {
        await route.fulfill({
          status: 401,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'unauthorized' })
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            addresses: [
              {
                id: "addr-123",
                label: "Home",
                type: "home",
                line1: "Apt 4B, Tanmatra Towers",
                line2: "Sector 62",
                city: "Noida",
                pincode: "201301",
                phone: "8700124135",
                isDefault: true,
                createdAt: "2026-07-10T00:00:00Z",
                updatedAt: "2026-07-10T00:00:00Z"
              }
            ]
          })
        });
      }
    });

    // Mock for OTP sending API
    await page.route('**/api/auth/phone/send-otp', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true })
      });
    });

    // Stateful mock for OTP verification API
    await page.route('**/api/auth/phone/verify-otp', async (route) => {
      isUserAuthenticated = true;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          user: {
            id: "mock-user-123",
            phoneE164: "+918700124135",
            email: "mock@tanmatra.food",
            firstName: "Mock",
            lastName: "User"
          }
        })
      });
    });

    // Mock for delivery slots API
    await page.route('**/api/delivery/slots**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          slots: [
            {
              id: 12,
              slotDate: "2026-07-10",
              startsAt: "12:00:00",
              endsAt: "13:00:00",
              zone: "default",
              capacity: 10,
              reservedCount: 2,
              remaining: 8,
              full: false
            }
          ]
        })
      });
    });

    // Intercept requests to https://tanmatra.food and map them to local baseURL
    await page.route('https://tanmatra.food/**', async (route) => {
      const requestUrl = new URL(route.request().url());
      const baseUrl = route.request().frame().page().context()._options.baseURL ?? 'http://127.0.0.1:5190';
      const localUrl = `${baseUrl}${requestUrl.pathname}${requestUrl.search}`;
      const response = await route.fetch({ url: localUrl });
      await route.fulfill({ response });
    });
  });

  test('Should execute E2E flow without loops, mathematical drift, or map blackouts', async ({ page }) => {
    test.setTimeout(60000);
    // -------------------------------------------------------------
    // VECTOR 1: DATA COMPLETION & ACCURATE RENDER TEST
    // -------------------------------------------------------------
    await page.goto('https://tanmatra.food/product/almond-chicken-salad');
    await expect(page.locator('#__tanmatra-loader')).toBeHidden({ timeout: 10000 });
    
    // Verify that the UI layout does not contain unverified placeholder markers
    const macroWarningText = page.locator('text=macros being verified');
    await expect(macroWarningText).not.toBeVisible(); 
    
    // Assert structural macro-bar density template is standard
    await expect(page.locator('.macro-nutrient-strip')).toBeVisible();

    // -------------------------------------------------------------
    // VECTOR 2: THE CARD MODIFIER & LEDGER MATH TEST
    // -------------------------------------------------------------
    // Select a complex protein modifier (+₹120)
    await page.locator('label', { hasText: 'Grilled chicken' }).click({ force: true });
    
    // Assert sticky bottom CTA calculates total precisely (Base ₹155 + Mod ₹120 = ₹275)
    await expect(page.locator('.sticky-total-bar .price')).toHaveText('₹275');

    // -------------------------------------------------------------
    // VECTOR 3: THE UPSELL STATE COMPONENT SYNCHRONIZATION TEST
    // -------------------------------------------------------------
    // Click Add to Order to open the cart drawer and expose upsell cards
    await page.locator('button:has-text("Add to Order")').click({ force: true });
    await page.locator('button[aria-label="Open sliding cart drawer"]').click({ force: true });

    // Assert that the sliding cart drawer automatically opens
    const cartDrawer = page.locator('.cart-drawer-container');
    await expect(cartDrawer).toBeVisible();

    // Scroll to upsell card and trigger an item addition (Cream of Broccoli - ₹125)
    const broccoliUpsellCard = cartDrawer.locator('.upsell-card', { hasText: 'Cream of Broccoli' });
    const addButton = broccoliUpsellCard.locator('button:has-text("+")');
    await addButton.scrollIntoViewIfNeeded();
    await addButton.click({ force: true });
    await page.waitForTimeout(500);

    // CRITICAL: Close the drawer layout to return to parent page context
    await page.keyboard.press('Escape');

    // ASSERTION: The parent page product card MUST retain state synchronization 
    // It must not flip back to default unselected '+' state
    await expect(page.locator('.parent-upsell-card', { hasText: 'Cream of Broccoli' }).locator('.quantity-badge')).toHaveText('1');

    // Re-open cart to initialize transaction processing
    await page.locator('button[aria-label="Open sliding cart drawer"]').click({ force: true });

    // ASSERTION: Verify Parent-Child structural isolation is not broken.
    // The cart must contain both the chosen parent salad and the addon item.
    await expect(cartDrawer.locator('.cart-item-title', { hasText: 'Almond Chicken Salad' })).toBeVisible();
    await expect(cartDrawer.locator('.cart-item-title', { hasText: 'Cream of Broccoli' })).toBeVisible();

    // ASSERTION: Validate that line item pricing matches the target config exactly without ghost additions
    await expect(cartDrawer.locator('.cart-item', { hasText: 'Almond Chicken Salad' }).locator('.price')).toHaveText('₹275'); // Catches the ₹329 software inflation bug instantly

    // Proceed cleanly to transaction staging
    await cartDrawer.locator('a:has-text("Checkout")').click({ force: true });

    // -------------------------------------------------------------
    // VECTOR 4: AUTHENTICATION ROUTING AND LIFECYCLE LOOPS
    // -------------------------------------------------------------
    // Execute secure phone input validation
    await page.fill('input[type="tel"]', '8700124135');
    await page.locator('button:has-text("Send")').click({ force: true });

    // Verify OTP container is exposed, insert target mock digits
    await page.fill('.otp-input-field', '387217');
    await page.locator('button:has-text("Verify")').click({ force: true });

    // ASSERTION: The page MUST route forward to the checkout view component
    // If the middleware errors out and loops back to login, the script breaks and throws a failure log here
    await expect(page).toHaveURL(/\/checkout$/);

    // -------------------------------------------------------------
    // VECTOR 5: THIRD-PARTY MAP PLATFORM COUPLING TEST
    // -------------------------------------------------------------
    await page.locator('button:has-text("Add New Address"), button:has-text("Add your delivery address")').first().click({ force: true });
    await page.locator('text=Select location on map').click({ force: true });

    // Monitor network socket pipelines for Map CDN and canvas loads
    const mapCanvasElement = page.locator('.gm-style, .mapboxgl-map'); // Targets native Google Maps or Mapbox frames
    
    // Assert that the canvas component initialization does not timeout or drop error banners
    await expect(mapCanvasElement).toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=Map tiles couldn\'t load')).not.toBeVisible();
  });
});
