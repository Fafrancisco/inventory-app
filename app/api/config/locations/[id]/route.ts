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
      DELETE FROM locations WHERE id = ${itemId} RETURNING id
    `;

    if (rows.length === 0) {
      return NextResponse.json({ error: "Localização não encontrada" }, { status: 404 });
    }
    return NextResponse.json({ deleted: true, id: rows[0].id });
  } catch (error) {
    console.error("DELETE /api/config/locations/[id] failed:", error);
    return NextResponse.json({ error: "Erro ao apagar localização" }, { status: 500 });
  }
}
