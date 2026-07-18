import { sql } from "@vercel/postgres";
import { NextRequest, NextResponse } from "next/server";
import type {
  StockItem,
  CreateStockItemPayload,
  PatchStockItemPayload,
} from "@/lib/types";

// ─── GET /api/stock ────────────────────────────────────────────────────────────
// Query params:
//   localizacao  – filter by location (optional)
//   shoppingList – when "true", return items where quantidade <= stock_minimo
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const localizacao = searchParams.get("localizacao");
    const shoppingList = searchParams.get("shoppingList") === "true";

    let result;

    if (shoppingList) {
      result =
        await sql<StockItem>`SELECT * FROM stock_items WHERE quantidade <= stock_minimo ORDER BY nome ASC`;
    } else if (localizacao) {
      result =
        await sql<StockItem>`SELECT * FROM stock_items WHERE localizacao = ${localizacao} ORDER BY nome ASC`;
    } else {
      result =
        await sql<StockItem>`SELECT * FROM stock_items ORDER BY nome ASC`;
    }

    return NextResponse.json(result.rows);
  } catch (error) {
    console.error("GET /api/stock error:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor." },
      { status: 500 }
    );
  }
}

// ─── POST /api/stock ───────────────────────────────────────────────────────────
// Body: CreateStockItemPayload
export async function POST(request: NextRequest) {
  try {
    const body: Partial<CreateStockItemPayload> = await request.json();

    const { nome, quantidade, unidade, localizacao, categoria, stock_minimo } =
      body;

    if (!nome || typeof nome !== "string" || nome.trim() === "") {
      return NextResponse.json(
        { error: "O campo 'nome' é obrigatório." },
        { status: 400 }
      );
    }

    const qty = quantidade ?? 0;
    const min = stock_minimo ?? 0;

    if (typeof qty !== "number" || qty < 0) {
      return NextResponse.json(
        { error: "'quantidade' deve ser um número não negativo." },
        { status: 400 }
      );
    }
    if (typeof min !== "number" || min < 0) {
      return NextResponse.json(
        { error: "'stock_minimo' deve ser um número não negativo." },
        { status: 400 }
      );
    }

    const result = await sql<StockItem>`
      INSERT INTO stock_items (nome, quantidade, unidade, localizacao, categoria, stock_minimo)
      VALUES (
        ${nome.trim()},
        ${qty},
        ${unidade ?? "un"},
        ${localizacao ?? "Despensa"},
        ${categoria ?? ""},
        ${min}
      )
      RETURNING *
    `;

    return NextResponse.json(result.rows[0], { status: 201 });
  } catch (error) {
    console.error("POST /api/stock error:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor." },
      { status: 500 }
    );
  }
}

// ─── PATCH /api/stock ─────────────────────────────────────────────────────────
// Body must include `id`.
// Mode A – quick adjust: include `delta` (positive or negative number).
// Mode B – partial update: include any combination of updatable fields.
export async function PATCH(request: NextRequest) {
  try {
    const body: Partial<PatchStockItemPayload> = await request.json();
    const { id } = body;

    if (!id || typeof id !== "string") {
      return NextResponse.json(
        { error: "O campo 'id' é obrigatório." },
        { status: 400 }
      );
    }

    // Verify the item exists
    const existing =
      await sql<StockItem>`SELECT * FROM stock_items WHERE id = ${id}`;
    if (existing.rowCount === 0) {
      return NextResponse.json(
        { error: "Item não encontrado." },
        { status: 404 }
      );
    }

    // Mode A: quick delta adjust
    if (body.delta !== undefined) {
      if (typeof body.delta !== "number") {
        return NextResponse.json(
          { error: "'delta' deve ser um número." },
          { status: 400 }
        );
      }
      const result = await sql<StockItem>`
        UPDATE stock_items
        SET quantidade = GREATEST(0, quantidade + ${body.delta})
        WHERE id = ${id}
        RETURNING *
      `;
      return NextResponse.json(result.rows[0]);
    }

    // Mode B: partial field update
    const { nome, quantidade, unidade, localizacao, categoria, stock_minimo } =
      body;

    // Allowlist of columns that may be updated – column names never come from
    // user input; they are selected from this set only.
    const ALLOWED_COLUMNS = new Set([
      "nome",
      "quantidade",
      "unidade",
      "localizacao",
      "categoria",
      "stock_minimo",
    ] as const);

    type AllowedColumn =
      | "nome"
      | "quantidade"
      | "unidade"
      | "localizacao"
      | "categoria"
      | "stock_minimo";

    const updates: Array<{ col: AllowedColumn; value: string | number }> = [];

    if (nome !== undefined) {
      if (typeof nome !== "string" || nome.trim() === "") {
        return NextResponse.json(
          { error: "'nome' não pode ser vazio." },
          { status: 400 }
        );
      }
      updates.push({ col: "nome", value: nome.trim() });
    }
    if (quantidade !== undefined) {
      if (typeof quantidade !== "number" || quantidade < 0) {
        return NextResponse.json(
          { error: "'quantidade' deve ser um número não negativo." },
          { status: 400 }
        );
      }
      updates.push({ col: "quantidade", value: quantidade });
    }
    if (unidade !== undefined) {
      updates.push({ col: "unidade", value: String(unidade) });
    }
    if (localizacao !== undefined) {
      updates.push({ col: "localizacao", value: String(localizacao) });
    }
    if (categoria !== undefined) {
      updates.push({ col: "categoria", value: String(categoria) });
    }
    if (stock_minimo !== undefined) {
      if (typeof stock_minimo !== "number" || stock_minimo < 0) {
        return NextResponse.json(
          { error: "'stock_minimo' deve ser um número não negativo." },
          { status: 400 }
        );
      }
      updates.push({ col: "stock_minimo", value: stock_minimo });
    }

    if (updates.length === 0) {
      return NextResponse.json(
        { error: "Nenhum campo para atualizar." },
        { status: 400 }
      );
    }

    // Build parameterized query. Column names are validated against the
    // allowlist above before being interpolated into the query string.
    const setClauses = updates.map(({ col }, i) => {
      if (!ALLOWED_COLUMNS.has(col)) {
        throw new Error(`Column not allowed: ${col}`);
      }
      return `${col} = $${i + 1}`;
    });
    const paramValues: (string | number)[] = [
      ...updates.map(({ value }) => value),
      id,
    ];

    // Use db.query for dynamic column lists (sql tagged template requires
    // static structure).
    const { db } = await import("@vercel/postgres");
    const client = await db.connect();
    try {
      const queryText = `UPDATE stock_items SET ${setClauses.join(", ")} WHERE id = $${updates.length + 1} RETURNING *`;
      const result = await client.query<StockItem>(queryText, paramValues);
      return NextResponse.json(result.rows[0]);
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("PATCH /api/stock error:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor." },
      { status: 500 }
    );
  }
}

// ─── DELETE /api/stock ────────────────────────────────────────────────────────
// Query param: id
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "O parâmetro 'id' é obrigatório." },
        { status: 400 }
      );
    }

    const result =
      await sql`DELETE FROM stock_items WHERE id = ${id} RETURNING id`;

    if (result.rowCount === 0) {
      return NextResponse.json(
        { error: "Item não encontrado." },
        { status: 404 }
      );
    }

    return NextResponse.json({ deleted: id });
  } catch (error) {
    console.error("DELETE /api/stock error:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor." },
      { status: 500 }
    );
  }
}
