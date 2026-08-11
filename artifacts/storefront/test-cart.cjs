const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();
  
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', error => console.log('PAGE ERROR:', error.message));

  await page.goto('http://localhost:3001/menu');
  console.log('Navigated to menu');
  
  // Wait for load
  await page.waitForLoadState('networkidle');
  
  // Find Add button and click
  const addBtn = page.getByRole('button', { name: 'Add' }).first();
  await addBtn.click();
  console.log('Clicked Add');
  
  // Wait for View cart
  const viewCart = page.getByRole('button', { name: 'View cart' });
  await viewCart.waitFor({ state: 'visible' });
  console.log('View cart is visible');
  
  // Click View cart
  await viewCart.click();
  console.log('Clicked View cart');
  
  // Wait for dialog
  try {
    const dialog = page.getByRole('dialog');
    await dialog.waitFor({ state: 'visible', timeout: 5000 });
    console.log('Dialog is visible');
    const heading = dialog.getByRole('heading', { name: 'Your cart' });
    await heading.waitFor({ state: 'visible', timeout: 5000 });
    console.log('Heading is visible');
  } catch (e) {
    console.error('Error:', e.message);
    const html = await page.content();
    console.log('DOM length:', html.length);
  }

  await browser.close();
})();
