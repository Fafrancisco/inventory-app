import { test, expect, type APIRequestContext, type Page } from "@playwright/test";

test.describe.configure({ mode: "serial" });
test.skip(!process.env.PROD_MUTATING, "Set PROD_MUTATING=true to run the production data-mutating flow.");

type StockItem = { id: number; nome: string };
type Recipe = { id: number };

let page: Page;
let request: APIRequestContext;
let baselineRecipeIds = new Set<number>();
const testItemName = `Playwright Test ${Date.now()}`;

async function deleteCreatedData(): Promise<void> {
  const stockResponse = await request.get("/api/stock");
  if (stockResponse.ok()) {
    const stockItems = (await stockResponse.json()) as StockItem[];
    for (const item of stockItems.filter((candidate) => candidate.nome === testItemName)) {
      await request.delete(`/api/stock/${item.id}`);
    }
  }

  const recipesResponse = await request.get("/api/recipes");
  if (recipesResponse.ok()) {
    const payload = (await recipesResponse.json()) as { recipes?: Recipe[] };
    for (const recipe of payload.recipes ?? []) {
      if (!baselineRecipeIds.has(recipe.id)) {
        await request.delete(`/api/recipes/${recipe.id}`);
      }
    }
  }
}

test.beforeEach(async ({ page: testPage }) => {
  page = testPage;
  request = page.request;

  const recipesResponse = await request.get("/api/recipes");
  if (recipesResponse.ok()) {
    const payload = (await recipesResponse.json()) as { recipes?: Recipe[] };
    baselineRecipeIds = new Set((payload.recipes ?? []).map((recipe) => recipe.id));
  }
});

test.afterEach(async () => {
  await deleteCreatedData();
});

test("creates stock, verifies quantity interactions, and triggers Chef AI", async () => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Inventário" })).toBeVisible();

  await page.getByRole("button", { name: "+ Novo" }).click();
  await page.getByPlaceholder("Nome do produto").fill(testItemName);

  const quantity = page.locator("form input[type=number]").first();
  await quantity.fill("1");
  await page.getByRole("button", { name: "Adicionar ao Inventário" }).click();

  const item = page.locator("li").filter({ hasText: testItemName });
  await expect(item).toBeVisible();
  await expect(item.getByText("1", { exact: true })).toBeVisible();

  await item.getByRole("button", { name: `Aumentar quantidade de ${testItemName}` }).click();
  await expect(item.getByText("2", { exact: true })).toBeVisible();

  await page.getByRole("link", { name: "Chef AI" }).click();
  await expect(page.getByRole("heading", { name: "Chef AI" })).toBeVisible();

  const recipeResponsePromise = page.waitForResponse(
    (response) => response.url().endsWith("/api/recipes") && response.request().method() === "POST"
  );
  await page.getByRole("button", { name: "Gerar" }).click();
  const recipeResponse = await recipeResponsePromise;
  expect(recipeResponse.status()).toBeLessThan(500);

  await page.getByRole("link", { name: "Voltar ao inventário" }).click();
  await expect(page.getByRole("heading", { name: "Inventário" })).toBeVisible();
});