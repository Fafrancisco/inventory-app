import { test, expect, Page } from "@playwright/test";

// ── Shared mock data ────────────────────────────────────────────────────────
const ITEMS = [
  { id: 1, nome: "Arroz", quantidade: 5, stock_minimo: 2, localizacao: "Cozinha", unidade: "kg", updated_at: "2024-01-01T00:00:00Z" },
  { id: 2, nome: "Detergente", quantidade: 1, stock_minimo: 2, localizacao: "Casa de banho", unidade: "un", updated_at: "2024-01-01T00:00:00Z" },
  { id: 3, nome: "Café", quantidade: 3, stock_minimo: 2, localizacao: "Cozinha", unidade: "un", updated_at: "2024-01-01T00:00:00Z" },
];

async function mockApi(page: Page, items = ITEMS) {
  // Intercept the initial list fetch
  await page.route("**/api/stock", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({ json: items });
    } else {
      // POST — return a fake new item
      const body = route.request().postDataJSON();
      await route.fulfill({
        status: 201,
        json: { id: 99, nome: body.nome, quantidade: body.quantidade ?? 0, stock_minimo: body.stock_minimo ?? 1, localizacao: body.localizacao ?? "", unidade: body.unidade ?? "un", updated_at: new Date().toISOString() },
      });
    }
  });

  // Intercept PATCH / DELETE for individual items
  await page.route("**/api/stock/**", async (route) => {
    const method = route.request().method();
    const url = route.request().url();
    const id = Number(url.split("/").pop());
    const item = items.find((i) => i.id === id);

    if (method === "PATCH" && item) {
      const { delta } = route.request().postDataJSON();
      await route.fulfill({ json: { ...item, quantidade: Math.max(0, item.quantidade + delta) } });
    } else if (method === "DELETE" && item) {
      await route.fulfill({ json: { deleted: true, id } });
    } else {
      await route.fulfill({ status: 404, json: { error: "Not found" } });
    }
  });
}

// ── Tests ───────────────────────────────────────────────────────────────────
test.describe("Inventory page", () => {
  test("loads and shows all items", async ({ page }) => {
    await mockApi(page);
    await page.goto("/");

    for (const item of ITEMS) {
      await expect(page.getByText(item.nome)).toBeVisible();
    }
    // Header shows correct counts
    await expect(page.getByText(/3 itens/)).toBeVisible();
  });

  test("shows low-stock badge on items at or below minimum", async ({ page }) => {
    await mockApi(page);
    await page.goto("/");

    // Detergente has quantidade 1 <= stock_minimo 2 → "Baixo" badge
    const detergente = page.locator("li").filter({ hasText: "Detergente" });
    await expect(detergente.getByText("Baixo")).toBeVisible();

    // Arroz is fine (5 > 2)
    const arroz = page.locator("li").filter({ hasText: "Arroz" });
    await expect(arroz.getByText("Baixo")).not.toBeVisible();
  });

  test("increments item quantity when + is clicked", async ({ page }) => {
    await mockApi(page);
    await page.goto("/");

    const arrozItem = page.locator("li").filter({ hasText: "Arroz" });
    await expect(arrozItem.getByText("5 kg")).toBeVisible();

    await arrozItem.getByRole("button", { name: "+" }).click();
    await expect(arrozItem.getByText("6 kg")).toBeVisible();
  });

  test("decrements item quantity when − is clicked", async ({ page }) => {
    await mockApi(page);
    await page.goto("/");

    const arrozItem = page.locator("li").filter({ hasText: "Arroz" });
    await arrozItem.getByRole("button", { name: "−" }).click();
    await expect(arrozItem.getByText("4 kg")).toBeVisible();
  });

  test("− button is disabled when quantity is 0", async ({ page }) => {
    const zeroItems = [{ ...ITEMS[0], quantidade: 0 }];
    await mockApi(page, zeroItems);
    await page.goto("/");

    const arrozItem = page.locator("li").filter({ hasText: "Arroz" });
    await expect(arrozItem.getByRole("button", { name: "−" })).toBeDisabled();
  });

  test("adds a new item via the form", async ({ page }) => {
    await mockApi(page);
    await page.goto("/");

    await page.getByRole("button", { name: "+ Novo" }).click();
    await page.getByPlaceholder("Nome do produto").fill("Leite");
    await page.getByRole("button", { name: "Adicionar" }).click();

    await expect(page.getByText("Leite")).toBeVisible();
  });

  test("cancelling the add form hides it without adding an item", async ({ page }) => {
    await mockApi(page);
    await page.goto("/");

    await page.getByRole("button", { name: "+ Novo" }).click();
    await expect(page.getByPlaceholder("Nome do produto")).toBeVisible();

    await page.getByRole("button", { name: "Cancelar" }).click();
    await expect(page.getByPlaceholder("Nome do produto")).not.toBeVisible();
  });

  test("deletes an item when Apagar is clicked and confirmed", async ({ page }) => {
    await mockApi(page);
    await page.goto("/");
    page.on("dialog", (d) => d.accept());

    await page.locator("li").filter({ hasText: "Arroz" }).getByRole("button", { name: "Apagar" }).click();
    await expect(page.getByText("Arroz")).not.toBeVisible();
  });

  test("location filter chips filter the item list", async ({ page }) => {
    await mockApi(page);
    await page.goto("/");

    // Click the "Cozinha" chip — only Cozinha items should remain visible
    await page.getByRole("button", { name: "Cozinha" }).click();
    await expect(page.getByText("Arroz")).toBeVisible();
    await expect(page.getByText("Café")).toBeVisible();
    await expect(page.getByText("Detergente")).not.toBeVisible();

    // Click "Todos" to reset
    await page.getByRole("button", { name: "Todos" }).click();
    await expect(page.getByText("Detergente")).toBeVisible();
  });

  test("Lista de Compras tab shows only low-stock items", async ({ page }) => {
    await mockApi(page);
    await page.goto("/");

    await page.getByRole("button", { name: /Lista de Compras/ }).click();

    // Only Detergente is below minimum
    await expect(page.getByText("Detergente")).toBeVisible();
    await expect(page.getByText("Arroz")).not.toBeVisible();
  });

  test("Lista de Compras shows checkmark when all items are in stock", async ({ page }) => {
    const fullStockItems = ITEMS.map((i) => ({ ...i, quantidade: i.stock_minimo + 5 }));
    await mockApi(page, fullStockItems);
    await page.goto("/");

    await page.getByRole("button", { name: /Lista de Compras/ }).click();
    await expect(page.getByText("Tudo bem em stock!")).toBeVisible();
  });
});
