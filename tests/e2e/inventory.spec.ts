import { test, expect, Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

// ── Shared mock data ────────────────────────────────────────────────────────
const ITEMS = [
  { id: 1, nome: "Arroz", quantidade: 5, stock_minimo: 2, localizacao: "Cozinha", unidade: "kg", categoria: "Padaria e Cereais", updated_at: "2024-01-01T00:00:00Z" },
  { id: 2, nome: "Detergente", quantidade: 1, stock_minimo: 2, localizacao: "Casa de banho", unidade: "un", categoria: "Limpeza", updated_at: "2024-01-01T00:00:00Z" },
  { id: 3, nome: "Café", quantidade: 3, stock_minimo: 2, localizacao: "Cozinha", unidade: "un", categoria: "Bebidas", updated_at: "2024-01-01T00:00:00Z" },
];

async function mockApi(
  page: Page,
  items = ITEMS,
  configProducts: Array<{ id: number; nome: string; unidade: string; localizacao_padrao?: string | null; categoria?: string | null }> = [],
  configLocations: Array<{ id: number; nome: string }> = []
) {
  // Keep recipe side-effects deterministic during inventory tests.
  await page.route("**/api/recipes", async (route) => {
    const method = route.request().method();
    if (method === "GET") {
      await route.fulfill({
        json: {
          preferences: {
            cuisine: "",
            diet: "",
            allergens: "",
            max_time_minutes: null,
            notes: "",
            auto_suggest_enabled: true,
            auto_suggest_cooldown_minutes: 180,
          },
          recipes: [],
        },
      });
      return;
    }

    if (method === "PUT") {
      const body = route.request().postDataJSON();
      await route.fulfill({ status: 200, json: body });
      return;
    }

    await route.fulfill({
      status: 202,
      json: { generated: false, skipped: true, reason: "test-mocked" },
    });
  });

  // Config routes
  await page.route("**/api/config/products", (route) => route.fulfill({ json: configProducts }));
  await page.route("**/api/config/locations", (route) => route.fulfill({ json: configLocations }));

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
    // Header shows correct total count in a robust way.
    const totalCard = page.locator("div").filter({ hasText: "itens no total" }).first();
    await expect(totalCard).toContainText(String(ITEMS.length));
  });

  test("dashboard has no automated accessibility violations", async ({ page }) => {
    await mockApi(page);
    await page.goto("/");

    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
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
    // quantity and unit are in separate spans
    await expect(arrozItem.getByText("5")).toBeVisible();

    await arrozItem.getByRole("button", { name: "Aumentar quantidade de Arroz" }).click();
    await expect(arrozItem.getByText("6")).toBeVisible();
  });

  test("edits item quantity via keyboard input", async ({ page }) => {
    await mockApi(page);
    await page.goto("/");

    const arrozItem = page.locator("li").filter({ hasText: "Arroz" });
    await arrozItem.getByRole("button", { name: "Editar quantidade de Arroz" }).click();

    const input = arrozItem.getByRole("spinbutton", { name: "Quantidade de Arroz" });
    await input.fill("9");
    await input.press("Enter");

    await expect(arrozItem.getByText("9")).toBeVisible();
  });

  test("decrements item quantity when − is clicked", async ({ page }) => {
    await mockApi(page);
    await page.goto("/");

    const arrozItem = page.locator("li").filter({ hasText: "Arroz" });
    await arrozItem.getByRole("button", { name: "Diminuir quantidade de Arroz" }).click();
    await expect(arrozItem.getByText("4")).toBeVisible();
  });

  test("− button is disabled when quantity is 0", async ({ page }) => {
    const zeroItems = [{ ...ITEMS[0], quantidade: 0 }];
    await mockApi(page, zeroItems);
    await page.goto("/");

    const arrozItem = page.locator("li").filter({ hasText: "Arroz" });
    await expect(arrozItem.getByRole("button", { name: "Diminuir quantidade de Arroz" })).toBeDisabled();
  });

  test("adds a new item via the form", async ({ page }) => {
    await mockApi(page);
    await page.goto("/");

    await page.getByRole("button", { name: "+ Novo" }).click();
    await page.getByPlaceholder("Nome do produto").fill("Leite");
    await page.getByRole("button", { name: "Adicionar ao Inventário" }).click();

    await expect(page.getByText("Leite")).toBeVisible();
  });

  test("filters product suggestions by substring and category", async ({ page }) => {
    const products = [
      { id: 1, nome: "Gel de banho hidratante", unidade: "un", localizacao_padrao: "Casa de banho", categoria: "Higiene Pessoal" },
      { id: 2, nome: "Detergente roupa", unidade: "un", localizacao_padrao: "Lavandaria", categoria: "Limpeza" },
    ];
    const locations = [
      { id: 1, nome: "Casa de banho" },
      { id: 2, nome: "Lavandaria" },
    ];

    await mockApi(page, ITEMS, products, locations);
    await page.goto("/");

    await page.getByRole("button", { name: "+ Novo" }).click();
    await page.locator("form select").first().selectOption("Higiene Pessoal");
    const productInput = page.getByPlaceholder("Escreve para filtrar produtos");
    await productInput.fill("banho");

    await page.getByRole("button", { name: /Gel de banho hidratante/ }).click();
    await expect(productInput).toHaveValue("Gel de banho hidratante");
  });

  test("closing the add form hides it without adding an item", async ({ page }) => {
    await mockApi(page);
    await page.goto("/");

    await page.getByRole("button", { name: "+ Novo" }).click();
    await expect(page.getByPlaceholder("Nome do produto")).toBeVisible();

    // Close via the ✕ button in the form header
    await page.getByRole("button", { name: "✕" }).click();
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
    await page.getByRole("button", { name: /📍 Cozinha/ }).click();
    await expect(page.getByText("Arroz")).toBeVisible();
    await expect(page.getByText("Café")).toBeVisible();
    await expect(page.getByText("Detergente")).not.toBeVisible();

    // Click "Todos" to reset
    await page.getByRole("button", { name: "Todos" }).click();
    await expect(page.getByText("Detergente")).toBeVisible();
  });

  test("category chips filter the item list", async ({ page }) => {
    await mockApi(page);
    await page.goto("/");

    await page.getByRole("button", { name: "Limpeza" }).click();
    await expect(page.getByText("Detergente")).toBeVisible();
    await expect(page.getByText("Arroz")).not.toBeVisible();

    await page.getByRole("button", { name: "Todas as categorias" }).click();
    await expect(page.getByText("Arroz")).toBeVisible();
  });

  test("Compras tab shows only low-stock items", async ({ page }) => {
    await mockApi(page);
    await page.goto("/");

    await page.getByRole("button", { name: /Compras/ }).click();

    // Only Detergente is below minimum
    await expect(page.getByText("Detergente")).toBeVisible();
    await expect(page.getByText("Arroz")).not.toBeVisible();
  });

  test("Compras shows checkmark when all items are in stock", async ({ page }) => {
    const fullStockItems = ITEMS.map((i) => ({ ...i, quantidade: i.stock_minimo + 5 }));
    await mockApi(page, fullStockItems);
    await page.goto("/");

    await page.getByRole("button", { name: /Compras/ }).click();
    await expect(page.getByText("Tudo em stock!")).toBeVisible();
  });
});

test.describe("Configurações page", () => {
  test("mobile forms keep controls and submit buttons visible", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });

    await page.route("**/api/config/products", async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({
          json: [
            { id: 1, nome: "Arroz", unidade: "kg", localizacao_padrao: "Despensa" },
          ],
        });
        return;
      }

      const body = route.request().postDataJSON();
      await route.fulfill({
        status: 201,
        json: {
          id: 99,
          nome: body.nome,
          unidade: body.unidade,
          localizacao_padrao: body.localizacao_padrao || null,
        },
      });
    });

    await page.route("**/api/config/products/**", async (route) => {
      await route.fulfill({ status: 200, json: { deleted: true } });
    });

    await page.route("**/api/config/locations", async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({
          json: [
            { id: 1, nome: "Despensa" },
            { id: 2, nome: "Armário superior da cozinha com recipientes longos" },
          ],
        });
        return;
      }

      const body = route.request().postDataJSON();
      await route.fulfill({
        status: 201,
        json: { id: 77, nome: body.nome },
      });
    });

    await page.route("**/api/config/locations/**", async (route) => {
      await route.fulfill({ status: 200, json: { deleted: true } });
    });

    await page.goto("/configuracoes");

    await expect(page.getByRole("button", { name: "Produtos" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Localizações" })).toBeVisible();

    await page.getByRole("button", { name: "Produtos" }).click();
    const addProductButton = page.locator('form:has(input[placeholder="Nome do produto"]) button[type="submit"]');
    await expect(addProductButton).toBeVisible();
    await page.getByPlaceholder("Nome do produto").fill("Leite");
    await addProductButton.click();
    await expect(page.getByText("Leite")).toBeVisible();

    await page.getByRole("button", { name: "Localizações" }).click();
    const addLocationButton = page.locator('form:has(input[placeholder="Nome da localização"]) button[type="submit"]');
    await expect(addLocationButton).toBeVisible();
    await page.getByPlaceholder("Nome da localização").fill("Lavandaria");
    await addLocationButton.click();
    await expect(page.getByText("📍 Lavandaria")).toBeVisible();
  });

  test("edits existing products and locations", async ({ page }) => {
    const products = [
      { id: 1, nome: "Arroz", unidade: "kg", localizacao_padrao: "Despensa" },
    ];
    const locations = [
      { id: 1, nome: "Despensa" },
      { id: 2, nome: "Cozinha" },
    ];

    await page.route("**/api/config/products", async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({ json: products });
        return;
      }
      await route.fulfill({ status: 500, json: { error: "Método inesperado" } });
    });

    await page.route("**/api/config/products/**", async (route) => {
      const method = route.request().method();
      const url = route.request().url();
      const id = Number(url.split("/").pop());

      if (method === "PUT") {
        const body = route.request().postDataJSON();
        const updated = {
          id,
          nome: body.nome,
          unidade: body.unidade,
          localizacao_padrao: body.localizacao_padrao || null,
        };
        await route.fulfill({ status: 200, json: updated });
        return;
      }

      await route.fulfill({ status: 200, json: { deleted: true, id } });
    });

    await page.route("**/api/config/locations", async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({ json: locations });
        return;
      }
      await route.fulfill({ status: 500, json: { error: "Método inesperado" } });
    });

    await page.route("**/api/config/locations/**", async (route) => {
      const method = route.request().method();
      const url = route.request().url();
      const id = Number(url.split("/").pop());

      if (method === "PUT") {
        const body = route.request().postDataJSON();
        await route.fulfill({ status: 200, json: { id, nome: body.nome } });
        return;
      }

      await route.fulfill({ status: 200, json: { deleted: true, id } });
    });

    await page.goto("/configuracoes");

    const productsSection = page.locator("section").filter({ hasText: "Produtos" }).first();
    await productsSection.locator("li").filter({ hasText: "Arroz" }).getByRole("button", { name: "Editar" }).click();
    await expect(productsSection.locator('input[value="Arroz"]')).toBeVisible();
    await productsSection.locator('input[value="Arroz"]').fill("Arroz Integral");
    await productsSection.getByRole("button", { name: "Guardar" }).first().click();
    await expect(page.getByText("Arroz Integral")).toBeVisible();

    const locationsSection = page.locator("section").filter({ hasText: "Localizações" }).first();
    await locationsSection.locator("li").filter({ hasText: "📍 Cozinha" }).getByRole("button", { name: "Editar" }).click();
    await expect(locationsSection.locator('input[value="Cozinha"]')).toBeVisible();
    await locationsSection.locator('input[value="Cozinha"]').fill("Cozinha Principal");
    await locationsSection.getByRole("button", { name: "Guardar" }).first().click();
    await expect(page.getByText("📍 Cozinha Principal")).toBeVisible();
  });
});
