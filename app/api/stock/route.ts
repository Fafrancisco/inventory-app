import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

function normalizeStockRow(row: Record<string, unknown>) {
  return {
    ...row,
    quantidade: Number(row.quantidade),
    stock_minimo: Number(row.stock_minimo),
  };
}

export async function GET() {
  try {
    const rows = await sql`
      SELECT
        s.id,
        s.nome,
        s.quantidade,
        s.stock_minimo,
        s.localizacao,
        s.unidade,
        s.updated_at,
        p.categoria
      FROM stock_items s
      LEFT JOIN products p ON p.nome = s.nome
      ORDER BY nome ASC
    `;
    return NextResponse.json(rows.map((row) => normalizeStockRow(row)));
  } catch (error) {
    console.error("GET /api/stock failed:", error);
    return NextResponse.json(
      { error: "Erro ao carregar itens" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { nome, quantidade = 0, stock_minimo = 1, localizacao = "", unidade = "un" } = body;

    if (!nome || typeof nome !== "string" || nome.trim() === "") {
      return NextResponse.json({ error: "Nome é obrigatório" }, { status: 400 });
    }

    const parsedQuantidade = Number(quantidade);
    const parsedStockMinimo = Number(stock_minimo);
    if (!Number.isFinite(parsedQuantidade) || parsedQuantidade < 0) {
      return NextResponse.json({ error: "quantidade inválida" }, { status: 400 });
    }
    if (!Number.isFinite(parsedStockMinimo) || parsedStockMinimo < 0) {
      return NextResponse.json({ error: "stock_minimo inválido" }, { status: 400 });
    }

    const rows = await sql`
      WITH inserted AS (
        INSERT INTO stock_items (nome, quantidade, stock_minimo, localizacao, unidade)
        VALUES (${nome.trim()}, ${parsedQuantidade}, ${parsedStockMinimo}, ${localizacao}, ${unidade})
        RETURNING id, nome, quantidade, stock_minimo, localizacao, unidade, updated_at
      )
      SELECT i.*, p.categoria
      FROM inserted i
      LEFT JOIN products p ON p.nome = i.nome
    `;
    return NextResponse.json(normalizeStockRow(rows[0]), { status: 201 });
  } catch (error) {
    console.error("POST /api/stock failed:", error);
    return NextResponse.json(
      { error: "Erro ao criar item" },
      { status: 500 }
    );
  }
}
