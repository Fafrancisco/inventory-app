import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks ──────────────────────────────────────────────────────────────────
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

function makeParams(id: string) {
  return Promise.resolve({ id });
}

// ── Import handlers after mocks are registered ─────────────────────────────
const { PATCH, DELETE } = await import("@/app/api/stock/[id]/route");

// ── PATCH ──────────────────────────────────────────────────────────────────
describe("PATCH /api/stock/[id]", () => {
  beforeEach(() => vi.clearAllMocks());

  function makeRequest(body: unknown) {
    return new Request("http://localhost/api/stock/1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  it("increments quantity and returns 200", async () => {
    const updated = makeItem({ quantidade: 6 });
    mockSql.mockResolvedValueOnce([updated]);

    const res = await PATCH(makeRequest({ delta: 1 }), { params: makeParams("1") });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.quantidade).toBe(6);
  });

  it("decrements quantity and returns 200", async () => {
    const updated = makeItem({ quantidade: 4 });
    mockSql.mockResolvedValueOnce([updated]);

    const res = await PATCH(makeRequest({ delta: -1 }), { params: makeParams("1") });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.quantidade).toBe(4);
  });

  it("returns 400 for a non-integer id", async () => {
    const res = await PATCH(makeRequest({ delta: 1 }), { params: makeParams("abc") });
    expect(res.status).toBe(400);
  });

  it("returns 400 for id <= 0", async () => {
    const res = await PATCH(makeRequest({ delta: 1 }), { params: makeParams("0") });
    expect(res.status).toBe(400);
  });

  it("returns 400 when delta is not an integer", async () => {
    const res = await PATCH(makeRequest({ delta: 1.5 }), { params: makeParams("1") });
    expect(res.status).toBe(400);
  });

  it("returns 400 when delta is missing", async () => {
    const res = await PATCH(makeRequest({}), { params: makeParams("1") });
    expect(res.status).toBe(400);
  });

  it("returns 404 when the item does not exist", async () => {
    mockSql.mockResolvedValueOnce([]); // empty result — no rows updated

    const res = await PATCH(makeRequest({ delta: 1 }), { params: makeParams("999") });
    expect(res.status).toBe(404);
  });

  it("returns 500 when the database throws", async () => {
    mockSql.mockRejectedValueOnce(new Error("db error"));

    const res = await PATCH(makeRequest({ delta: 1 }), { params: makeParams("1") });
    expect(res.status).toBe(500);
  });
});

// ── DELETE ─────────────────────────────────────────────────────────────────
describe("DELETE /api/stock/[id]", () => {
  beforeEach(() => vi.clearAllMocks());

  function makeRequest() {
    return new Request("http://localhost/api/stock/1", { method: "DELETE" });
  }

  it("deletes an item and returns { deleted: true, id }", async () => {
    mockSql.mockResolvedValueOnce([{ id: 1 }]);

    const res = await DELETE(makeRequest(), { params: makeParams("1") });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ deleted: true, id: 1 });
  });

  it("returns 400 for a non-integer id", async () => {
    const res = await DELETE(makeRequest(), { params: makeParams("abc") });
    expect(res.status).toBe(400);
  });

  it("returns 400 for id <= 0", async () => {
    const res = await DELETE(makeRequest(), { params: makeParams("-1") });
    expect(res.status).toBe(400);
  });

  it("returns 404 when the item does not exist", async () => {
    mockSql.mockResolvedValueOnce([]); // no rows deleted

    const res = await DELETE(makeRequest(), { params: makeParams("999") });
    expect(res.status).toBe(404);
  });

  it("returns 500 when the database throws", async () => {
    mockSql.mockRejectedValueOnce(new Error("db error"));

    const res = await DELETE(makeRequest(), { params: makeParams("1") });
    expect(res.status).toBe(500);
  });
});
