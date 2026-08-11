import { test, expect } from "@playwright/test";

test("debug cart", async ({ page }) => {
  await page.goto("http://127.0.0.1:3001/menu");
  await page.waitForLoadState("networkidle");
  
  const addBtn = page.getByRole("button", { name: "Add" }).first();
  await addBtn.waitFor({ state: "visible" });
  await addBtn.click();
  
  const viewCart = page.getByRole("button", { name: "View cart" });
  await viewCart.waitFor({ state: "visible" });
  await viewCart.click();
  
  console.log('Dialog visible?');
  const dialog = page.getByRole("dialog");
  await dialog.waitFor({ state: "visible", timeout: 2000 }).catch(e => console.log('Dialog not visible:', e));
  
  console.log('Heading visible?');
  const heading = dialog.getByRole("heading", { name: "Your cart" });
  await heading.waitFor({ state: "visible", timeout: 2000 }).catch(e => console.log('Heading not visible:', e));
  
  const html = await page.content();
  console.log(html.slice(html.indexOf('Your cart') - 100, html.indexOf('Your cart') + 100));
});
