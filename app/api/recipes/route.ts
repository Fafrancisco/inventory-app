import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

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
  categoria?: string | null;
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

type MissingIngredient = {
  nome: string;
  quantidade: string;
  unidade: string;
  notes: string;
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
  is_favorite: boolean;
  created_at: string;
};

class GeminiApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

const DEFAULT_MODEL = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";
const GEMINI_FALLBACK_MODELS = ["gemini-3.5-flash-lite", "gemini-2.5-flash"];
const CONTEXT_RECIPES_LIMIT = 5;
const CONTEXT_RECIPE_SUMMARY_MAX_LEN = 220;
const CONTEXT_RECIPE_INGREDIENTS_MAX = 10;

const NON_EDIBLE_CATEGORY_KEYWORDS = [
  "limpeza",
  "higiene",
  "casa",
  "farmacia",
  "farmácia",
];

const NON_EDIBLE_NAME_KEYWORDS = [
  "detergente",
  "lixivia",
  "lixívia",
  "desinfetante",
  "limpa",
  "champo",
  "champô",
  "gel de banho",
  "pasta de dentes",
  "desodorizante",
  "sabon",
  "fralda",
  "pilha",
  "papel higienico",
  "papel higiénico",
  "esponja",
  "sacos de lixo",
];

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

function truncateText(value: string, maxLen: number): string {
  if (value.length <= maxLen) return value;
  return `${value.slice(0, Math.max(0, maxLen - 1)).trim()}...`;
}

function normalizeComparable(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}+/gu, "")
    .toLowerCase()
    .trim();
}

function isEdibleStockItem(item: StockRow): boolean {
  const categoria = normalizeComparable(item.categoria ?? "");
  const nome = normalizeComparable(item.nome);

  if (NON_EDIBLE_CATEGORY_KEYWORDS.some((keyword) => categoria.includes(keyword))) {
    return false;
  }

  if (NON_EDIBLE_NAME_KEYWORDS.some((keyword) => nome.includes(keyword))) {
    return false;
  }

  return true;
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

function parseModelJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    // Some model responses may include extra text around the JSON object.
    const firstBrace = text.indexOf("{");
    const lastBrace = text.lastIndexOf("}");
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      const candidate = text.slice(firstBrace, lastBrace + 1);
      return JSON.parse(candidate);
    }
    throw new Error("Gemini devolveu JSON inválido");
  }
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
        .slice(0, CONTEXT_RECIPE_INGREDIENTS_MAX)
        .map((ing) => {
          const entry = parseJsonObject<Record<string, unknown>>(ing, {});
          const nome = normalizeText(entry.nome, "");
          const quantidade = normalizeText(entry.quantidade, "");
          const unidade = normalizeText(entry.unidade, "");
          return [nome, quantidade, unidade].filter(Boolean).join(" ").trim();
        })
        .filter(Boolean)
        .join(", ");

      const compactSummary = truncateText(normalizeText(recipe.summary, ""), CONTEXT_RECIPE_SUMMARY_MAX_LEN);
      return `- ${truncateText(recipe.title, 70)}: ${compactSummary}${ingredientList ? ` | ingredientes: ${ingredientList}` : ""}`;
    })
    .join("\n");

  return [
    "Atua como um chef experiente de cozinha caseira.",
    "Objetivo: criar receitas com sabor e praticidade, mantendo boa aceitacao por criancas.",
    "Privilegia receitas diretas para o dia a dia, sem tecnicas desnecessariamente complexas.",
    "Prioriza receitas existentes e reconhecidas (tradicionais ou amplamente conhecidas) em vez de inventar receitas novas.",
    "Usa nomes canonicos e reais de pratos (ex.: arroz de frango, massa com atum, sopa de legumes) e evita titulos criativos inventados.",
    "Se o inventario nao permitir a receita tradicional completa, adapta uma receita conhecida com substituicoes simples.",
    "So propoe uma combinacao menos comum quando nao houver opcao razoavel de receita conhecida com os ingredientes disponiveis.",
    "Admite leve picante ocasional, mas evita receitas demasiado picantes por defeito.",
    "Usa preferencialmente ingredientes existentes no inventario; aceita algumas faltas quando melhorarem claramente o resultado.",
    "Quando houver faltas, diferencia ingredientes essenciais de opcionais no campo notes de cada ingrediente (prefixa com 'ESSENCIAL:' ou 'OPCIONAL:').",
    "Sempre que possivel, sugere substituicoes simples no campo notes para ingredientes em falta.",
    "As preferências do utilizador abaixo têm prioridade máxima.",
    "Se existir qualquer conflito entre estas regras base e as preferências do utilizador, segue sempre as preferências do utilizador.",
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
    "Trata esta secção de preferências como instruções de maior prioridade.",
    "",
    "Receitas anteriores para evitar repeticoes:",
    previousRecipes || "(sem historico)",
    "",
    "Marca available=true apenas quando o ingrediente existe claramente no inventario acima; caso contrario available=false.",
    "Se faltar ingrediente, usa notes para indicar uma alternativa opcional quando fizer sentido.",
    "Formato JSON esperado:",
    '{"title":"string","summary":"string","servings":number|null,"prepMinutes":number|null,"cookMinutes":number|null,"instructions":["passo 1"],"ingredients":[{"nome":"string","quantidade":"string","unidade":"string","available":true,"notes":"string"}]}'
  ].join("\n");
}

function isIngredientAvailable(nome: string, inventoryNormalized: Set<string>): boolean {
  const target = normalizeComparable(nome);
  if (!target) {
    return true;
  }

  if (inventoryNormalized.has(target)) {
    return true;
  }

  for (const candidate of inventoryNormalized) {
    if (!candidate) continue;
    if (candidate.includes(target) || target.includes(candidate)) {
      return true;
    }
  }

  return false;
}

function enrichWithAvailability(
  recipe: GeneratedRecipe,
  inventory: StockRow[]
): { ingredients: GeneratedIngredient[]; missingIngredients: MissingIngredient[] } {
  const inventoryNormalized = new Set(
    inventory
      .map((item) => normalizeComparable(item.nome))
      .filter(Boolean)
  );

  const ingredients = recipe.ingredients.map((ingredient) => {
    const available = isIngredientAvailable(ingredient.nome, inventoryNormalized);
    return {
      ...ingredient,
      available,
    };
  });

  const missingMap = new Map<string, MissingIngredient>();
  for (const ingredient of ingredients) {
    if (ingredient.available) continue;
    const key = normalizeComparable(ingredient.nome);
    if (!key || missingMap.has(key)) continue;
    missingMap.set(key, {
      nome: ingredient.nome,
      quantidade: ingredient.quantidade,
      unidade: ingredient.unidade,
      notes: ingredient.notes,
    });
  }

  return {
    ingredients,
    missingIngredients: Array.from(missingMap.values()),
  };
}

function buildModelCandidates(): string[] {
  const candidates = [DEFAULT_MODEL, ...GEMINI_FALLBACK_MODELS]
    .map((model) => model.trim())
    .filter(Boolean);

  return Array.from(new Set(candidates));
}

function normalizeModelNameForApi(model: string): string {
  return model.startsWith("models/") ? model : `models/${model}`;
}

function extractQuotaMessage(payload: unknown): string | null {
  const parsed = parseJsonObject<Record<string, unknown>>(payload, {});
  const error = parseJsonObject<Record<string, unknown>>(parsed.error, {});
  const message = normalizeText(error.message, "");
  return message || null;
}

async function callGemini(prompt: string): Promise<GeneratedRecipe> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY não configurada");
  }

  const models = buildModelCandidates();
  let lastError: Error | null = null;

  for (const model of models) {
    const modelPath = normalizeModelNameForApi(model);

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/${modelPath}:generateContent?key=${encodeURIComponent(apiKey)}`,
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
            maxOutputTokens: 1600,
          },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      let errorPayload: unknown = { raw: errorText };
      try {
        errorPayload = JSON.parse(errorText);
      } catch {
        // Keep raw text when provider does not return JSON.
      }
      const quotaMessage = extractQuotaMessage(errorPayload);

      if (response.status === 429) {
        // If one model is quota-limited, try the next fallback model.
        lastError = new GeminiApiError(
          quotaMessage
            ? `Quota do Gemini excedida no modelo ${model}: ${quotaMessage}`
            : `Quota do Gemini excedida no modelo ${model}.`,
          429
        );
        continue;
      }

      throw new GeminiApiError(
        `Gemini API respondeu ${response.status}: ${JSON.stringify(errorPayload)}`,
        response.status
      );
    }

    const payload = await response.json();
    const text = payload?.candidates?.[0]?.content?.parts
      ?.map((part: { text?: string }) => part.text ?? "")
      .join("\n")
      .trim();

    if (!text) {
      lastError = new Error(`Gemini não devolveu conteúdo de texto (${model})`);
      continue;
    }

    let raw: unknown;
    try {
      raw = parseModelJson(text);
    } catch {
      lastError = new Error(`Gemini devolveu JSON inválido (${model})`);
      continue;
    }

    return normalizeGeneratedRecipe(raw);
  }

  if (lastError) {
    throw lastError;
  }

  throw new Error("Falha desconhecida ao chamar Gemini");
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
    SELECT id, title, summary, servings, prep_minutes, cook_minutes, ingredients_json, instructions_json, generation_mode, is_favorite, created_at
    FROM recipes
    ORDER BY created_at DESC
    LIMIT ${Math.min(Math.max(limit, 1), 50)}
  `;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limitParam = Number(searchParams.get("limit") ?? "20");
    const [preferences, recipes] = await Promise.all([
      getPreferences(),
      getRecipes(Number.isFinite(limitParam) ? limitParam : 20),
    ]);

    return NextResponse.json({
      preferences,
      recipes: recipes.map((recipe) => {
        const ingredients = parseJsonArray(recipe.ingredients_json);
        const missingIngredients = ingredients
          .map((ing) => parseJsonObject<Record<string, unknown>>(ing, {}))
          .filter((ing) => ing.available === false)
          .map((ing) => ({
            nome: normalizeText(ing.nome, "Ingrediente"),
            quantidade: normalizeText(ing.quantidade, ""),
            unidade: normalizeText(ing.unidade, "un"),
            notes: normalizeText(ing.notes, ""),
          }));

        return {
          id: recipe.id,
          title: recipe.title,
          summary: recipe.summary,
          servings: recipe.servings,
          prepMinutes: recipe.prep_minutes,
          cookMinutes: recipe.cook_minutes,
          ingredients,
          missingIngredients,
          instructions: parseJsonArray(recipe.instructions_json),
          generationMode: recipe.generation_mode,
          isFavorite: recipe.is_favorite,
          createdAt: recipe.created_at,
        };
      }),
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
    const body = await request.json().catch(() => ({}));
    const mode = body.mode === "auto" ? "auto" : "manual";
    const force = Boolean(body.force);

    const [inventory, preferences, contextRecipes] = await Promise.all([
      sql<StockRow[]>`
        SELECT s.id, s.nome, s.quantidade, s.unidade, s.localizacao, p.categoria
        FROM stock_items s
        LEFT JOIN products p ON p.nome = s.nome
        WHERE s.quantidade > 0
        ORDER BY s.nome ASC
      `,
      getPreferences(),
      sql<ContextRecipeRow[]>`
        SELECT id, title, summary, ingredients_json
        FROM recipes
        ORDER BY created_at DESC
        LIMIT ${CONTEXT_RECIPES_LIMIT}
      `,
    ]);

    const edibleInventory = inventory.filter(isEdibleStockItem);

    if (edibleInventory.length === 0) {
      return NextResponse.json(
        { error: "Não há ingredientes comestíveis no inventário para gerar receita" },
        { status: 400 }
      );
    }

    const inventorySignature = buildInventorySignature(edibleInventory);

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

    const prompt = buildGeminiPrompt(edibleInventory, preferences, contextRecipes);
    const generated = await callGemini(prompt);
    const enriched = enrichWithAvailability(generated, edibleInventory);
    const contextIds = contextRecipes.map((recipe: ContextRecipeRow) => recipe.id);

    const inserted = await sql<
      { id: number; title: string; summary: string; servings: number | null; prep_minutes: number | null; cook_minutes: number | null; ingredients_json: unknown; instructions_json: unknown; generation_mode: string; is_favorite: boolean; created_at: string }[]
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
        ${JSON.stringify(enriched.ingredients)}::jsonb,
        ${JSON.stringify(generated.instructions)}::jsonb,
        ${JSON.stringify(edibleInventory)}::jsonb,
        ${JSON.stringify(contextIds)}::jsonb,
        ${mode},
        ${inventorySignature}
      )
      RETURNING id, title, summary, servings, prep_minutes, cook_minutes, ingredients_json, instructions_json, generation_mode, is_favorite, created_at
    `;

    const recipe = inserted[0];

    for (const ingredient of enriched.ingredients) {
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
          missingIngredients: enriched.missingIngredients,
          instructions: parseJsonArray(recipe.instructions_json),
          generationMode: recipe.generation_mode,
          isFavorite: recipe.is_favorite,
          createdAt: recipe.created_at,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST /api/recipes failed:", error);
    const message = error instanceof Error ? error.message : "Erro ao gerar receita";

    if (error instanceof GeminiApiError) {
      return NextResponse.json({ error: message }, { status: error.status });
    }

    if (message.toLowerCase().includes("quota") || message.toLowerCase().includes("429")) {
      return NextResponse.json({ error: message }, { status: 429 });
    }

    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
