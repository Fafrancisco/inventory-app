import { NextResponse } from "next/server";
import { sql, ensureSchema } from "@/lib/db";

export async function GET() {
  try {
    await ensureSchema();
    const rows = await sql`
      SELECT id, nome FROM locations ORDER BY nome ASC
    `;
    return NextResponse.json(rows);
  } catch (error) {
    console.error("GET /api/config/locations failed:", error);
    return NextResponse.json({ error: "Erro ao carregar localizações" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await ensureSchema();
    const body = await request.json();
    const { nome } = body;

    if (!nome || typeof nome !== "string" || nome.trim() === "") {
      return NextResponse.json({ error: "Nome é obrigatório" }, { status: 400 });
    }

    const rows = await sql`
      INSERT INTO locations (nome)
      VALUES (${nome.trim()})
      ON CONFLICT (nome) DO NOTHING
      RETURNING id, nome
    `;

    if (rows.length === 0) {
      return NextResponse.json({ error: "Localização já existe" }, { status: 409 });
    }
    return NextResponse.json(rows[0], { status: 201 });
  } catch (error) {
    console.error("POST /api/config/locations failed:", error);
    return NextResponse.json({ error: "Erro ao criar localização" }, { status: 500 });
  }
}
