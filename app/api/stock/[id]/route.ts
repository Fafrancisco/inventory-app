import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

export async function PATCH(
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
    const hasDelta = typeof body.delta === "number" && Number.isFinite(body.delta);
    const hasStockMinimo = typeof body.stock_minimo === "number" && Number.isFinite(body.stock_minimo);

    if (!hasDelta && !hasStockMinimo) {
      return NextResponse.json(
        { error: "envie delta ou stock_minimo numérico" },
        { status: 400 }
      );
    }

    let rows;
    if (hasStockMinimo) {
      const stockMinimo = Math.max(0, Number(body.stock_minimo));
      rows = await sql`
        WITH updated AS (
          UPDATE stock_items
          SET stock_minimo = ${stockMinimo},
              updated_at = NOW()
          WHERE id = ${itemId}
          RETURNING id, nome, quantidade, stock_minimo, localizacao, unidade, updated_at
        )
        SELECT u.*, p.categoria
        FROM updated u
        LEFT JOIN products p ON p.nome = u.nome
      `;
    } else {
      const delta = Number(body.delta);
      rows = await sql`
        WITH updated AS (
          UPDATE stock_items
          SET quantidade = GREATEST(0, quantidade + ${delta}),
              updated_at = NOW()
          WHERE id = ${itemId}
          RETURNING id, nome, quantidade, stock_minimo, localizacao, unidade, updated_at
        )
        SELECT u.*, p.categoria
        FROM updated u
        LEFT JOIN products p ON p.nome = u.nome
      `;
    }

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
