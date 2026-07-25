import { NextResponse } from "next/server";
import { ensureSchema, sql } from "@/lib/db";

type RecipePreferenceRow = {
  cuisine: string;
  diet: string;
  allergens: string;
  max_time_minutes: number | null;
  notes: string;
  auto_suggest_enabled: boolean;
  auto_suggest_cooldown_minutes: number;
  updated_at: string;
};

type StockRow = {
  id: number;
  nome: string;
  quantidade: number;
  unidade: string;
  localizacao: string;
};

type ContextRecipeRow = {
  id: number;
  title: string;
  summary: string;
  ingredients_json: unknown;
};

type GeneratedIngredient = {
  nome: string;
  quantidade: string;
  unidade: string;
  available: boolean;
  notes: string;
};

type GeneratedRecipe = {
  title: string;
  summary: string;
  servings: number | null;
  prepMinutes: number | null;
  cookMinutes: number | null;
  instructions: string[];
  ingredients: GeneratedIngredient[];
};

type RecipeRecord = {
  id: number;
  title: string;
  summary: string;
  servings: number | null;
  prep_minutes: number | null;
  cook_minutes: number | null;
  ingredients_json: unknown;
  instructions_json: unknown;
  generation_mode: string;
  created_at: string;
};

const DEFAULT_MODEL = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";

function parseJsonArray(value: unknown): unknown[] {
  if (Array.isArray(value)) {
    return value;
  }
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function parseJsonObject<T>(value: unknown, fallback: T): T {
  if (value && typeof value === "object") {
    return value as T;
  }
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return (parsed && typeof parsed === "object" ? parsed : fallback) as T;
    } catch {
      return fallback;
    }
  }
  return fallback;
}

function normalizeText(value: unknown, fallback = ""): string {
  if (typeof value !== "string") {
    return fallback;
  }
  return value.trim();
}

function normalizeInt(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }
  const rounded = Math.round(value);
  return rounded >= 0 ? rounded : null;
}

function buildInventorySignature(items: StockRow[]): string {
  return [...items]
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt"))
    .map((item) => `${item.nome.toLowerCase()}|${item.quantidade}|${item.unidade.toLowerCase()}`)
    .join("||");
}

function normalizeGeneratedRecipe(raw: unknown): GeneratedRecipe {
  const fallback: GeneratedRecipe = {
    title: "Receita sugerida",
    summary: "",
    servings: null,
    prepMinutes: null,
    cookMinutes: null,
    instructions: [],
    ingredients: [],
  };

  const parsed = parseJsonObject<Record<string, unknown>>(raw, {});
  const ingredientsRaw = Array.isArray(parsed.ingredients) ? parsed.ingredients : [];
  const instructionsRaw = Array.isArray(parsed.instructions) ? parsed.instructions : [];

  const ingredients = ingredientsRaw
    .map((ingredient) => parseJsonObject<Record<string, unknown>>(ingredient, {}))
    .map((ingredient): GeneratedIngredient => ({
      nome: normalizeText(ingredient.nome, "Ingrediente"),
      quantidade: normalizeText(ingredient.quantidade, ""),
      unidade: normalizeText(ingredient.unidade, "un"),
      available: typeof ingredient.available === "boolean" ? ingredient.available : true,
      notes: normalizeText(ingredient.notes, ""),
    }))
    .slice(0, 25);

  const instructions = instructionsRaw
    .filter((step): step is string => typeof step === "string")
    .map((step) => step.trim())
    .filter(Boolean)
    .slice(0, 20);

  return {
    title: normalizeText(parsed.title, fallback.title),
    summary: normalizeText(parsed.summary, ""),
    servings: normalizeInt(parsed.servings),
    prepMinutes: normalizeInt(parsed.prepMinutes),
    cookMinutes: normalizeInt(parsed.cookMinutes),
    instructions,
    ingredients,
  };
}

function buildGeminiPrompt(
  inventory: StockRow[],
  preferences: RecipePreferenceRow,
  contextRecipes: ContextRecipeRow[]
): string {
  const inventoryLines = inventory
    .map((item) => `${item.nome}: ${item.quantidade} ${item.unidade}${item.localizacao ? ` (${item.localizacao})` : ""}`)
    .join("\n");

  const previousRecipes = contextRecipes
    .map((recipe) => {
      const ingredientList = parseJsonArray(recipe.ingredients_json)
        .map((ing) => {
          const entry = parseJsonObject<Record<string, unknown>>(ing, {});
          const nome = normalizeText(entry.nome, "");
          const quantidade = normalizeText(entry.quantidade, "");
          const unidade = normalizeText(entry.unidade, "");
          return [nome, quantidade, unidade].filter(Boolean).join(" ").trim();
        })
        .filter(Boolean)
        .join(", ");

      return `- ${recipe.title}: ${recipe.summary}${ingredientList ? ` | ingredientes: ${ingredientList}` : ""}`;
    })
    .join("\n");

  return [
    "Gera uma receita em portugues europeu com base no inventario atual.",
    "Responde apenas em JSON valido, sem markdown.",
    "",
    "Inventario:",
    inventoryLines || "(sem itens)",
    "",
    "Preferencias:",
    `- cozinha: ${preferences.cuisine || "qualquer"}`,
    `- dieta: ${preferences.diet || "sem restricoes"}`,
    `- alergias/intolerancias: ${preferences.allergens || "nenhuma indicada"}`,
    `- tempo maximo: ${preferences.max_time_minutes ?? "sem limite"} minutos`,
    `- notas livres: ${preferences.notes || "nenhuma"}`,
    "",
    "Receitas anteriores para evitar repeticoes:",
    previousRecipes || "(sem historico)",
    "",
    "Formato JSON esperado:",
    '{"title":"string","summary":"string","servings":number|null,"prepMinutes":number|null,"cookMinutes":number|null,"instructions":["passo 1"],"ingredients":[{"nome":"string","quantidade":"string","unidade":"string","available":true,"notes":"string"}]}'
  ].join("\n");
}

async function callGemini(prompt: string): Promise<GeneratedRecipe> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY não configurada");
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(DEFAULT_MODEL)}:generateContent?key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0.4,
        },
      }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API respondeu ${response.status}: ${errorText}`);
  }

  const payload = await response.json();
  const text = payload?.candidates?.[0]?.content?.parts
    ?.map((part: { text?: string }) => part.text ?? "")
    .join("\n")
    .trim();

  if (!text) {
    throw new Error("Gemini não devolveu conteúdo de texto");
  }

  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error("Gemini devolveu JSON inválido");
  }

  return normalizeGeneratedRecipe(raw);
}

async function getPreferences(): Promise<RecipePreferenceRow> {
  const rows = await sql<RecipePreferenceRow[]>`
    SELECT cuisine, diet, allergens, max_time_minutes, notes, auto_suggest_enabled, auto_suggest_cooldown_minutes, updated_at
    FROM recipe_preferences
    WHERE id = 1
    LIMIT 1
  `;

  if (rows.length > 0) {
    return rows[0];
  }

  return {
    cuisine: "",
    diet: "",
    allergens: "",
    max_time_minutes: null,
    notes: "",
    auto_suggest_enabled: true,
    auto_suggest_cooldown_minutes: 180,
    updated_at: new Date().toISOString(),
  };
}

async function getRecipes(limit = 20): Promise<RecipeRecord[]> {
  return sql<RecipeRecord[]>`
    SELECT id, title, summary, servings, prep_minutes, cook_minutes, ingredients_json, instructions_json, generation_mode, created_at
    FROM recipes
    ORDER BY created_at DESC
    LIMIT ${Math.min(Math.max(limit, 1), 50)}
  `;
}

export async function GET(request: Request) {
  try {
    await ensureSchema();
    const { searchParams } = new URL(request.url);
    const limitParam = Number(searchParams.get("limit") ?? "20");
    const [preferences, recipes] = await Promise.all([
      getPreferences(),
      getRecipes(Number.isFinite(limitParam) ? limitParam : 20),
    ]);

    return NextResponse.json({
      preferences,
      recipes: recipes.map((recipe) => ({
        id: recipe.id,
        title: recipe.title,
        summary: recipe.summary,
        servings: recipe.servings,
        prepMinutes: recipe.prep_minutes,
        cookMinutes: recipe.cook_minutes,
        ingredients: parseJsonArray(recipe.ingredients_json),
        instructions: parseJsonArray(recipe.instructions_json),
        generationMode: recipe.generation_mode,
        createdAt: recipe.created_at,
      })),
    });
  } catch (error) {
    console.error("GET /api/recipes failed:", error);
    return NextResponse.json(
      { error: "Erro ao carregar receitas" },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    await ensureSchema();
    const body = await request.json();

    const cuisine = normalizeText(body.cuisine, "");
    const diet = normalizeText(body.diet, "");
    const allergens = normalizeText(body.allergens, "");
    const notes = normalizeText(body.notes, "");
    const autoSuggestEnabled = typeof body.autoSuggestEnabled === "boolean" ? body.autoSuggestEnabled : true;

    const maxTimeMinutes =
      typeof body.maxTimeMinutes === "number" && Number.isFinite(body.maxTimeMinutes)
        ? Math.max(0, Math.round(body.maxTimeMinutes))
        : null;

    const cooldownRaw =
      typeof body.autoSuggestCooldownMinutes === "number" && Number.isFinite(body.autoSuggestCooldownMinutes)
        ? Math.round(body.autoSuggestCooldownMinutes)
        : 180;
    const autoSuggestCooldownMinutes = Math.max(5, cooldownRaw);

    const rows = await sql<RecipePreferenceRow[]>`
      INSERT INTO recipe_preferences (id, cuisine, diet, allergens, max_time_minutes, notes, auto_suggest_enabled, auto_suggest_cooldown_minutes, updated_at)
      VALUES (1, ${cuisine}, ${diet}, ${allergens}, ${maxTimeMinutes}, ${notes}, ${autoSuggestEnabled}, ${autoSuggestCooldownMinutes}, NOW())
      ON CONFLICT (id)
      DO UPDATE SET
        cuisine = EXCLUDED.cuisine,
        diet = EXCLUDED.diet,
        allergens = EXCLUDED.allergens,
        max_time_minutes = EXCLUDED.max_time_minutes,
        notes = EXCLUDED.notes,
        auto_suggest_enabled = EXCLUDED.auto_suggest_enabled,
        auto_suggest_cooldown_minutes = EXCLUDED.auto_suggest_cooldown_minutes,
        updated_at = NOW()
      RETURNING cuisine, diet, allergens, max_time_minutes, notes, auto_suggest_enabled, auto_suggest_cooldown_minutes, updated_at
    `;

    return NextResponse.json(rows[0]);
  } catch (error) {
    console.error("PUT /api/recipes failed:", error);
    return NextResponse.json(
      { error: "Erro ao guardar preferências" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    await ensureSchema();
    const body = await request.json().catch(() => ({}));
    const mode = body.mode === "auto" ? "auto" : "manual";
    const force = Boolean(body.force);

    const [inventory, preferences, contextRecipes] = await Promise.all([
      sql<StockRow[]>`
        SELECT id, nome, quantidade, unidade, localizacao
        FROM stock_items
        WHERE quantidade > 0
        ORDER BY nome ASC
      `,
      getPreferences(),
      sql<ContextRecipeRow[]>`
        SELECT id, title, summary, ingredients_json
        FROM recipes
        ORDER BY created_at DESC
        LIMIT 5
      `,
    ]);

    if (inventory.length === 0) {
      return NextResponse.json(
        { error: "Não há ingredientes no inventário para gerar receita" },
        { status: 400 }
      );
    }

    const inventorySignature = buildInventorySignature(inventory);

    if (mode === "auto") {
      if (!preferences.auto_suggest_enabled) {
        return NextResponse.json({ generated: false, skipped: true, reason: "auto-disabled" }, { status: 202 });
      }

      const latestAutoRows = await sql<{ created_at: string; inventory_signature: string }[]>`
        SELECT created_at, inventory_signature
        FROM recipes
        WHERE generation_mode = 'auto'
        ORDER BY created_at DESC
        LIMIT 1
      `;

      if (latestAutoRows.length > 0) {
        const latest = latestAutoRows[0];
        if (!force && latest.inventory_signature === inventorySignature) {
          return NextResponse.json({ generated: false, skipped: true, reason: "same-inventory" }, { status: 202 });
        }

        const cooldownMs = preferences.auto_suggest_cooldown_minutes * 60 * 1000;
        const latestTimestamp = new Date(latest.created_at).getTime();
        if (!force && Number.isFinite(latestTimestamp) && Date.now() - latestTimestamp < cooldownMs) {
          return NextResponse.json({ generated: false, skipped: true, reason: "cooldown" }, { status: 202 });
        }
      }
    }

    const prompt = buildGeminiPrompt(inventory, preferences, contextRecipes);
    const generated = await callGemini(prompt);
    const contextIds = contextRecipes.map((recipe: ContextRecipeRow) => recipe.id);

    const inserted = await sql<
      { id: number; title: string; summary: string; servings: number | null; prep_minutes: number | null; cook_minutes: number | null; ingredients_json: unknown; instructions_json: unknown; generation_mode: string; created_at: string }[]
    >`
      INSERT INTO recipes (
        title,
        summary,
        servings,
        prep_minutes,
        cook_minutes,
        ingredients_json,
        instructions_json,
        source_inventory_json,
        context_recipe_ids_json,
        generation_mode,
        inventory_signature
      )
      VALUES (
        ${generated.title},
        ${generated.summary},
        ${generated.servings},
        ${generated.prepMinutes},
        ${generated.cookMinutes},
        ${JSON.stringify(generated.ingredients)}::jsonb,
        ${JSON.stringify(generated.instructions)}::jsonb,
        ${JSON.stringify(inventory)}::jsonb,
        ${JSON.stringify(contextIds)}::jsonb,
        ${mode},
        ${inventorySignature}
      )
      RETURNING id, title, summary, servings, prep_minutes, cook_minutes, ingredients_json, instructions_json, generation_mode, created_at
    `;

    const recipe = inserted[0];

    for (const ingredient of generated.ingredients) {
      await sql`
        INSERT INTO recipe_ingredients (recipe_id, nome, quantidade, unidade, available, notes)
        VALUES (${recipe.id}, ${ingredient.nome}, ${ingredient.quantidade}, ${ingredient.unidade}, ${ingredient.available}, ${ingredient.notes})
      `;
    }

    return NextResponse.json(
      {
        generated: true,
        recipe: {
          id: recipe.id,
          title: recipe.title,
          summary: recipe.summary,
          servings: recipe.servings,
          prepMinutes: recipe.prep_minutes,
          cookMinutes: recipe.cook_minutes,
          ingredients: parseJsonArray(recipe.ingredients_json),
          instructions: parseJsonArray(recipe.instructions_json),
          generationMode: recipe.generation_mode,
          createdAt: recipe.created_at,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST /api/recipes failed:", error);
    return NextResponse.json(
      { error: "Erro ao gerar receita" },
      { status: 500 }
    );
  }
}
