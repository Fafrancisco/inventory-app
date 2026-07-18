import { NextResponse } from "next/server";
import { sql, ensureSchema } from "@/lib/db";

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
