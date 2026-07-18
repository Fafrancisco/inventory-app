import { NextResponse } from "next/server";
import { sql, ensureSchema } from "@/lib/db";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await ensureSchema();
    const { id } = await params;
    const itemId = Number(id);
    if (!Number.isInteger(itemId) || itemId <= 0) {
      return NextResponse.json({ error: "ID inválido" }, { status: 400 });
    }

    const body = await request.json();
    const { delta } = body;
    if (typeof delta !== "number" || !Number.isInteger(delta)) {
      return NextResponse.json({ error: "delta deve ser um inteiro" }, { status: 400 });
    }

    const rows = await sql`
      UPDATE stock_items
      SET quantidade = GREATEST(0, quantidade + ${delta}),
          updated_at = NOW()
      WHERE id = ${itemId}
      RETURNING id, nome, quantidade, stock_minimo, localizacao, unidade, updated_at
    `;

    if (rows.length === 0) {
      return NextResponse.json({ error: "Item não encontrado" }, { status: 404 });
    }
    return NextResponse.json(rows[0]);
  } catch (error) {
    console.error("PATCH /api/stock/[id] failed:", error);
    return NextResponse.json(
      { error: "Erro ao atualizar item" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await ensureSchema();
    const { id } = await params;
    const itemId = Number(id);
    if (!Number.isInteger(itemId) || itemId <= 0) {
      return NextResponse.json({ error: "ID inválido" }, { status: 400 });
    }

    const rows = await sql`
      DELETE FROM stock_items WHERE id = ${itemId} RETURNING id
    `;

    if (rows.length === 0) {
      return NextResponse.json({ error: "Item não encontrado" }, { status: 404 });
    }
    return NextResponse.json({ deleted: true, id: rows[0].id });
  } catch (error) {
    console.error("DELETE /api/stock/[id] failed:", error);
    return NextResponse.json(
      { error: "Erro ao apagar item" },
      { status: 500 }
    );
  }
}
