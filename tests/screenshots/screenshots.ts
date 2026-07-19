import { test, Page } from "@playwright/test";
import path from "path";
import fs from "fs";

const OUT = path.join(process.cwd(), "docs/screenshots");

const ITEMS = [
  { id: 1, nome: "Arroz", quantidade: 5, stock_minimo: 2, localizacao: "Cozinha", unidade: "kg", updated_at: "2024-01-01T00:00:00Z" },
  { id: 2, nome: "Azeite", quantidade: 2, stock_minimo: 1, localizacao: "Cozinha", unidade: "L", updated_at: "2024-01-01T00:00:00Z" },
  { id: 3, nome: "Café", quantidade: 3, stock_minimo: 2, localizacao: "Cozinha", unidade: "kg", updated_at: "2024-01-01T00:00:00Z" },
  { id: 4, nome: "Detergente loiça", quantidade: 1, stock_minimo: 2, localizacao: "Cozinha", unidade: "un", updated_at: "2024-01-01T00:00:00Z" },
  { id: 5, nome: "Papel higiénico", quantidade: 3, stock_minimo: 6, localizacao: "Casa de banho", unidade: "un", updated_at: "2024-01-01T00:00:00Z" },
  { id: 6, nome: "Champô", quantidade: 1, stock_minimo: 1, localizacao: "Casa de banho", unidade: "un", updated_at: "2024-01-01T00:00:00Z" },
  { id: 7, nome: "Leite", quantidade: 4, stock_minimo: 2, localizacao: "Frigorífico", unidade: "L", updated_at: "2024-01-01T00:00:00Z" },
  { id: 8, nome: "Ovos", quantidade: 6, stock_minimo: 4, localizacao: "Frigorífico", unidade: "un", updated_at: "2024-01-01T00:00:00Z" },
];

const PRODUCTS = [
  { id: 1, nome: "Arroz", unidade: "kg" },
  { id: 2, nome: "Café", unidade: "kg" },
  { id: 3, nome: "Leite", unidade: "L" },
  { id: 4, nome: "Ovos", unidade: "un" },
  { id: 5, nome: "Azeite", unidade: "L" },
];

const LOCATIONS = [
  { id: 1, nome: "Cozinha" },
  { id: 2, nome: "Casa de banho" },
  { id: 3, nome: "Frigorífico" },
];

async function setupMocks(page: Page, items = ITEMS) {
  await page.route("**/api/config/products", (r) => r.fulfill({ json: PRODUCTS }));
  await page.route("**/api/config/locations", (r) => r.fulfill({ json: LOCATIONS }));
  await page.route("**/api/stock", async (r) => {
    if (r.request().method() === "GET") {
      await r.fulfill({ json: items });
    } else {
      const body = r.request().postDataJSON();
      await r.fulfill({
        status: 201,
        json: { id: 99, ...body, updated_at: new Date().toISOString() },
      });
    }
  });
  await page.route("**/api/stock/**", async (r) => {
    const method = r.request().method();
    const id = Number(r.request().url().split("/").pop());
    const item = items.find((i) => i.id === id);
    if (method === "PATCH" && item) {
      const { delta } = r.request().postDataJSON();
      await r.fulfill({ json: { ...item, quantidade: Math.max(0, item.quantidade + delta) } });
    } else {
      await r.fulfill({ status: 404, json: {} });
    }
  });
}

function out(name: string) {
  return path.join(OUT, name);
}

test("generate screenshots", async ({ page }) => {
  fs.mkdirSync(OUT, { recursive: true });

  // 01 — Dashboard (all items)
  await setupMocks(page);
  await page.goto("/");
  await page.waitForSelector("ul li");
  await page.screenshot({ path: out("01-dashboard.png"), fullPage: true });

  // 02 — Filter: Cozinha
  await page.getByRole("button", { name: /📍 Cozinha/ }).click();
  await page.screenshot({ path: out("02-filter-cozinha.png"), fullPage: true });

  // 03 — Filter: Casa de banho
  await page.getByRole("button", { name: /📍 Casa de banho/ }).click();
  await page.screenshot({ path: out("03-filter-casa-de-banho.png"), fullPage: true });

  // Reset filter
  await page.getByRole("button", { name: "Todos" }).click();

  // 04 — Lista de compras
  await page.getByRole("button", { name: /Compras/ }).click();
  await page.screenshot({ path: out("04-lista-compras.png"), fullPage: true });

  // 05 — Add form open
  await page.getByRole("button", { name: "Inventário" }).click();
  await page.getByRole("button", { name: "+ Novo" }).click();
  await page.waitForSelector("text=Novo Item");
  await page.screenshot({ path: out("05-add-form-open.png"), fullPage: true });

  // 06 — Add form filled
  await page.locator("select").first().selectOption({ label: "Arroz" });
  await page.locator("input[type=number]").first().fill("10");
  await page.locator("select").nth(1).selectOption({ label: "Cozinha" });
  await page.screenshot({ path: out("06-add-form-filled.png"), fullPage: true });

  // 07 — After adding item
  await page.getByRole("button", { name: "Adicionar ao Inventário" }).click();
  await page.waitForSelector("text=Novo Item", { state: "hidden" });
  await page.screenshot({ path: out("07-item-added.png"), fullPage: true });

  // 08 — Quantity incremented
  const arrozItem = page.locator("li").filter({ hasText: "Arroz" }).first();
  await arrozItem.getByRole("button", { name: "+" }).click();
  await page.screenshot({ path: out("08-quantity-incremented.png"), fullPage: true });

  // 09 — Quantity decremented
  await arrozItem.getByRole("button", { name: "−" }).click();
  await page.screenshot({ path: out("09-quantity-decremented.png"), fullPage: true });

  // 10 — Lista de compras updated
  await page.getByRole("button", { name: /Compras/ }).click();
  await page.screenshot({ path: out("10-lista-compras-updated.png"), fullPage: true });
});
