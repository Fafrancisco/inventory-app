import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

export async function GET() {
  try {
    const rows = await sql`
      SELECT id, nome, unidade, localizacao_padrao, categoria FROM products ORDER BY nome ASC
    `;
    return NextResponse.json(rows);
  } catch (error) {
    console.error("GET /api/config/products failed:", error);
    return NextResponse.json({ error: "Erro ao carregar produtos" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { nome, unidade = "un", localizacao_padrao = "" } = body;

    if (!nome || typeof nome !== "string" || nome.trim() === "") {
      return NextResponse.json({ error: "Nome é obrigatório" }, { status: 400 });
    }

    const defaultLocation =
      typeof localizacao_padrao === "string" ? localizacao_padrao.trim() : "";

    if (defaultLocation) {
      const locationRows = await sql`
        SELECT id FROM locations WHERE nome = ${defaultLocation} LIMIT 1
      `;
      if (locationRows.length === 0) {
        return NextResponse.json({ error: "Localização não encontrada" }, { status: 400 });
      }
    }

    const rows = await sql`
      INSERT INTO products (nome, unidade, localizacao_padrao)
      VALUES (${nome.trim()}, ${unidade}, ${defaultLocation || null})
      ON CONFLICT (nome) DO NOTHING
      RETURNING id, nome, unidade, localizacao_padrao, categoria
    `;

    if (rows.length === 0) {
      return NextResponse.json({ error: "Produto já existe" }, { status: 409 });
    }
    return NextResponse.json(rows[0], { status: 201 });
  } catch (error) {
    console.error("POST /api/config/products failed:", error);
    return NextResponse.json({ error: "Erro ao criar produto" }, { status: 500 });
  }
}
