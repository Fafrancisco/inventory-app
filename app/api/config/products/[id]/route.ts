import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const itemId = Number(id);
    if (!Number.isInteger(itemId) || itemId <= 0) {
      return NextResponse.json({ error: "ID inválido" }, { status: 400 });
    }

    const body = await request.json();
    const { nome, unidade = "un", localizacao_padrao = "" } = body;

    if (!nome || typeof nome !== "string" || nome.trim() === "") {
      return NextResponse.json({ error: "Nome é obrigatório" }, { status: 400 });
    }

    const defaultLocation =
      typeof localizacao_padrao === "string" ? localizacao_padrao.trim() : "";

    const rows = await sql`
      UPDATE products
      SET
        nome = ${nome.trim()},
        unidade = ${unidade},
        localizacao_padrao = ${defaultLocation || null}
      WHERE id = ${itemId}
      RETURNING id, nome, unidade, localizacao_padrao
    `;

    if (rows.length === 0) {
      return NextResponse.json({ error: "Produto não encontrado" }, { status: 404 });
    }

    return NextResponse.json(rows[0]);
  } catch (error) {
    console.error("PUT /api/config/products/[id] failed:", error);
    return NextResponse.json({ error: "Erro ao atualizar produto" }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const itemId = Number(id);
    if (!Number.isInteger(itemId) || itemId <= 0) {
      return NextResponse.json({ error: "ID inválido" }, { status: 400 });
    }

    const rows = await sql`
      DELETE FROM products WHERE id = ${itemId} RETURNING id
    `;

    if (rows.length === 0) {
      return NextResponse.json({ error: "Produto não encontrado" }, { status: 404 });
    }
    return NextResponse.json({ deleted: true, id: rows[0].id });
  } catch (error) {
    console.error("DELETE /api/config/products/[id] failed:", error);
    return NextResponse.json({ error: "Erro ao apagar produto" }, { status: 500 });
  }
}
