# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: smoke.spec.ts >> Production smoke >> loads inventory and returns from Chef AI within the UX budget
- Location: tests/e2e/production/smoke.spec.ts:4:7

# Error details

```
Error: page.goto: net::ERR_NAME_NOT_RESOLVED at https://inventory-app-ff-hub.vercel.app/inventario
Call log:
  - navigating to "https://inventory-app-ff-hub.vercel.app/inventario", waiting until "domcontentloaded"

```

# Test source

```ts
  1  | import { test, expect } from "@playwright/test";
  2  | 
  3  | test.describe("Production smoke", () => {
  4  |   test("loads inventory and returns from Chef AI within the UX budget", async ({ page }) => {
> 5  |     await page.goto("/inventario", { waitUntil: "domcontentloaded" });
     |                ^ Error: page.goto: net::ERR_NAME_NOT_RESOLVED at https://inventory-app-ff-hub.vercel.app/inventario
  6  |     await expect(page.getByRole("heading", { name: "Inventário" })).toBeVisible();
  7  | 
  8  |     await page.getByRole("link", { name: "Chef AI" }).click();
  9  |     await expect(page.getByRole("heading", { name: "Chef AI" })).toBeVisible();
  10 | 
  11 |     const startedAt = Date.now();
  12 |     await page.getByRole("link", { name: "Voltar ao inventário" }).click();
  13 |     await expect(page.getByRole("heading", { name: "Inventário" })).toBeVisible();
  14 |     await expect(page.getByRole("button", { name: /Novo/ })).toBeVisible();
  15 | 
  16 |     expect(Date.now() - startedAt).toBeLessThan(3000);
  17 |   });
  18 | 
  19 |   test("loads settings without browser errors", async ({ page }) => {
  20 |     const consoleErrors: string[] = [];
  21 |     page.on("console", (message) => {
  22 |       if (message.type() === "error") consoleErrors.push(message.text());
  23 |     });
  24 | 
  25 |     await page.goto("/configuracoes", { waitUntil: "domcontentloaded" });
  26 |     await expect(page.getByRole("heading", { name: "Configurações" })).toBeVisible();
  27 |     expect(consoleErrors).toEqual([]);
  28 |   });
  29 | });
```