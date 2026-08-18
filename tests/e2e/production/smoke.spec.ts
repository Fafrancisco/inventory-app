import { test, expect } from "@playwright/test";

test.describe("Production smoke", () => {
  test("loads inventory and returns from Chef AI within the UX budget", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Inventário" })).toBeVisible();

    await page.getByRole("link", { name: "Chef AI" }).click();
    await expect(page.getByRole("heading", { name: "Chef AI" })).toBeVisible();

    const startedAt = Date.now();
    await page.getByRole("link", { name: "Voltar ao inventário" }).click();
    await expect(page.getByRole("heading", { name: "Inventário" })).toBeVisible();
    await expect(page.getByRole("button", { name: /Novo/ })).toBeVisible();

    expect(Date.now() - startedAt).toBeLessThan(3000);
  });

  test("loads settings without browser errors", async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") consoleErrors.push(message.text());
    });

    await page.goto("/configuracoes", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Configurações" })).toBeVisible();
    expect(consoleErrors).toEqual([]);
  });
});