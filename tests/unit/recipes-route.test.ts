import { beforeEach, describe, expect, it, vi } from "vitest";

const mockSql = vi.fn();
const ensureSchemaMock = vi.fn().mockResolvedValue(undefined);

vi.mock("@/lib/db", () => ({
  sql: mockSql,
  ensureSchema: ensureSchemaMock,
}));

const { GET, PUT, POST } = await import("@/app/api/recipes/route");

describe("/api/recipes route", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv, GEMINI_API_KEY: "test-key", GEMINI_MODEL: "gemini-2.5-flash" };
  });

  it("GET returns preferences and recipes", async () => {
    mockSql
      .mockResolvedValueOnce([
        {
          cuisine: "mediterrânica",
          diet: "",
          allergens: "",
          max_time_minutes: 30,
          notes: "",
          auto_suggest_enabled: true,
          auto_suggest_cooldown_minutes: 180,
          updated_at: "2026-07-25T10:00:00.000Z",
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 1,
          title: "Arroz salteado",
          summary: "Rápido e simples",
          servings: 2,
          prep_minutes: 10,
          cook_minutes: 15,
          ingredients_json: JSON.stringify([{ nome: "Arroz", quantidade: "200", unidade: "g", available: true, notes: "" }]),
          instructions_json: JSON.stringify(["Cozer arroz", "Saltear"]),
          generation_mode: "manual",
          created_at: "2026-07-25T10:00:00.000Z",
        },
      ]);

    const res = await GET(new Request("http://localhost/api/recipes?limit=10"));
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.preferences.cuisine).toBe("mediterrânica");
    expect(body.recipes).toHaveLength(1);
    expect(body.recipes[0].title).toBe("Arroz salteado");
  });

  it("PUT saves preferences", async () => {
    mockSql.mockResolvedValueOnce([
      {
        cuisine: "portuguesa",
        diet: "vegetariana",
        allergens: "lactose",
        max_time_minutes: 25,
        notes: "evitar fritos",
        auto_suggest_enabled: true,
        auto_suggest_cooldown_minutes: 120,
        updated_at: "2026-07-25T10:00:00.000Z",
      },
    ]);

    const res = await PUT(
      new Request("http://localhost/api/recipes", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cuisine: "portuguesa",
          diet: "vegetariana",
          allergens: "lactose",
          maxTimeMinutes: 25,
          notes: "evitar fritos",
          autoSuggestEnabled: true,
          autoSuggestCooldownMinutes: 120,
        }),
      })
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.diet).toBe("vegetariana");
  });

  it("POST generates and stores a recipe", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify({
                    title: "Massa com atum",
                    summary: "Receita simples",
                    servings: 2,
                    prepMinutes: 10,
                    cookMinutes: 12,
                    instructions: ["Cozer a massa", "Juntar o atum"],
                    ingredients: [
                      { nome: "Massa", quantidade: "200", unidade: "g", available: true, notes: "" },
                      { nome: "Atum", quantidade: "1", unidade: "un", available: true, notes: "" },
                    ],
                  }),
                },
              ],
            },
          },
        ],
      }),
      text: async () => "",
    });

    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [{ text: JSON.stringify({
                title: "Massa com atum",
                summary: "Receita simples",
                servings: 2,
                prepMinutes: 10,
                cookMinutes: 12,
                instructions: ["Cozer a massa", "Juntar o atum"],
                ingredients: [
                  { nome: "Massa", quantidade: "200", unidade: "g", available: true, notes: "" },
                ],
              }) }],
            },
          },
        ],
      }),
    });
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        candidates: [{ content: { parts: [{ inlineData: { mimeType: "image/png", data: "aW1hZ2U=" } }] } }],
      }),
    });

    vi.stubGlobal("fetch", fetchMock);

    mockSql
      .mockResolvedValueOnce([{ id: 1, nome: "Massa", quantidade: 1, unidade: "kg", localizacao: "Cozinha" }])
      .mockResolvedValueOnce([
        {
          cuisine: "",
          diet: "",
          allergens: "",
          max_time_minutes: null,
          notes: "",
          auto_suggest_enabled: true,
          auto_suggest_cooldown_minutes: 180,
          updated_at: "2026-07-25T10:00:00.000Z",
        },
      ])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          id: 42,
          title: "Massa com atum",
          summary: "Receita simples",
          servings: 2,
          prep_minutes: 10,
          cook_minutes: 12,
          ingredients_json: JSON.stringify([
            { nome: "Massa", quantidade: "200", unidade: "g", available: true, notes: "" },
            { nome: "Atum", quantidade: "1", unidade: "un", available: true, notes: "" },
          ]),
          instructions_json: JSON.stringify(["Cozer a massa", "Juntar o atum"]),
          generation_mode: "manual",
          created_at: "2026-07-25T10:00:00.000Z",
        },
      ])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    const res = await POST(
      new Request("http://localhost/api/recipes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "manual" }),
      })
    );

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.generated).toBe(true);
    expect(body.recipe.title).toBe("Massa com atum");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
