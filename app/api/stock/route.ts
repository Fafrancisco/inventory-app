import { NextResponse } from "next/server";
import { sql, ensureSchema } from "@/lib/db";

export async function GET() {
  try {
    await ensureSchema();
    const rows = await sql`
      SELECT id, nome, quantidade, stock_minimo, localizacao, unidade, updated_at
      FROM stock_items
      ORDER BY nome ASC
    `;
    return NextResponse.json(rows);
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
    await ensureSchema();
    const body = await request.json();
    const { nome, quantidade = 0, stock_minimo = 1, localizacao = "", unidade = "un" } = body;

    if (!nome || typeof nome !== "string" || nome.trim() === "") {
      return NextResponse.json({ error: "Nome é obrigatório" }, { status: 400 });
    }

    const rows = await sql`
      INSERT INTO stock_items (nome, quantidade, stock_minimo, localizacao, unidade)
      VALUES (${nome.trim()}, ${Number(quantidade)}, ${Number(stock_minimo)}, ${localizacao}, ${unidade})
      RETURNING id, nome, quantidade, stock_minimo, localizacao, unidade, updated_at
    `;
    return NextResponse.json(rows[0], { status: 201 });
  } catch (error) {
    console.error("POST /api/stock failed:", error);
    return NextResponse.json(
      { error: "Erro ao criar item" },
      { status: 500 }
    );
  }
}
