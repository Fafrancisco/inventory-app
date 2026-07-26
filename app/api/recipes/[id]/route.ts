import { NextResponse } from "next/server";
import { ensureSchema, sql } from "@/lib/db";

type RecipeUpdateRow = {
  id: number;
  is_favorite: boolean;
};

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await ensureSchema();
    const { id } = await params;
    const recipeId = Number(id);

    if (!Number.isInteger(recipeId) || recipeId <= 0) {
      return NextResponse.json({ error: "ID inválido" }, { status: 400 });
    }

    const body = await request.json().catch(() => ({}));
    const isFavorite = Boolean(body.isFavorite);

    const rows = await sql<RecipeUpdateRow[]>`
      UPDATE recipes
      SET is_favorite = ${isFavorite}
      WHERE id = ${recipeId}
      RETURNING id, is_favorite
    `;

    if (rows.length === 0) {
      return NextResponse.json({ error: "Receita não encontrada" }, { status: 404 });
    }

    return NextResponse.json({
      id: rows[0].id,
      isFavorite: rows[0].is_favorite,
    });
  } catch (error) {
    console.error("PATCH /api/recipes/[id] failed:", error);
    return NextResponse.json({ error: "Erro ao atualizar receita" }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await ensureSchema();
    const { id } = await params;
    const recipeId = Number(id);

    if (!Number.isInteger(recipeId) || recipeId <= 0) {
      return NextResponse.json({ error: "ID inválido" }, { status: 400 });
    }

    const rows = await sql<{ id: number }[]>`
      DELETE FROM recipes
      WHERE id = ${recipeId}
      RETURNING id
    `;

    if (rows.length === 0) {
      return NextResponse.json({ error: "Receita não encontrada" }, { status: 404 });
    }

    return NextResponse.json({ deleted: true, id: rows[0].id });
  } catch (error) {
    console.error("DELETE /api/recipes/[id] failed:", error);
    return NextResponse.json({ error: "Erro ao apagar receita" }, { status: 500 });
  }
}
