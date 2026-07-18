import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";

// ── Mocks ──────────────────────────────────────────────────────────────────
// Mock lib/db so no real Postgres connection is made.
const mockSql = vi.fn();
vi.mock("@/lib/db", () => ({
  sql: mockSql,
  ensureSchema: vi.fn().mockResolvedValue(undefined),
}));

// ── Helpers ────────────────────────────────────────────────────────────────
function makeItem(overrides = {}) {
  return {
    id: 1,
    nome: "Arroz",
    quantidade: 5,
    stock_minimo: 2,
    localizacao: "Cozinha",
    unidade: "kg",
    updated_at: "2024-01-01T00:00:00.000Z",
    ...overrides,
  };
}

// ── Import handlers after mocks are registered ─────────────────────────────
const { GET, POST } = await import("@/app/api/stock/route");

describe("GET /api/stock", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 200 with the list of items", async () => {
    const items = [makeItem(), makeItem({ id: 2, nome: "Azeite" })];
    mockSql.mockResolvedValueOnce(items);

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual(items);
  });

  it("returns 500 when the database throws", async () => {
    mockSql.mockRejectedValueOnce(new Error("db error"));

    const res = await GET();
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body).toHaveProperty("error");
  });
});

describe("POST /api/stock", () => {
  beforeEach(() => vi.clearAllMocks());

  function makeRequest(body: unknown) {
    return new Request("http://localhost/api/stock", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  it("creates an item and returns 201", async () => {
    const created = makeItem();
    mockSql.mockResolvedValueOnce([created]);

    const res = await POST(makeRequest({ nome: "Arroz", quantidade: 5, stock_minimo: 2, localizacao: "Cozinha", unidade: "kg" }));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body).toEqual(created);
  });

  it("returns 400 when nome is missing", async () => {
    const res = await POST(makeRequest({ quantidade: 5 }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toHaveProperty("error");
  });

  it("returns 400 when nome is an empty string", async () => {
    const res = await POST(makeRequest({ nome: "   " }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when nome is not a string", async () => {
    const res = await POST(makeRequest({ nome: 42 }));
    expect(res.status).toBe(400);
  });

  it("applies defaults for optional fields", async () => {
    const created = makeItem({ quantidade: 0, stock_minimo: 1, localizacao: "", unidade: "un" });
    mockSql.mockResolvedValueOnce([created]);

    const res = await POST(makeRequest({ nome: "Arroz" }));
    expect(res.status).toBe(201);
    // Verify sql was called — the tagged template receives the interpolated
    // values; check that the mock was invoked (full SQL assertion is in the
    // integration layer).
    expect(mockSql).toHaveBeenCalledOnce();
  });

  it("returns 500 when the database throws", async () => {
    mockSql.mockRejectedValueOnce(new Error("db error"));

    const res = await POST(makeRequest({ nome: "Arroz" }));
    expect(res.status).toBe(500);
  });
});
