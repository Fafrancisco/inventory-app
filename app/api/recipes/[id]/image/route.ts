import { NextResponse } from "next/server";
import { callGeminiImage } from "@/lib/recipe-image";
import { sql } from "@/lib/db";

type RecipeRow = {
  id: number;
  title: string;
  summary: string;
  ingredients_json: unknown;
};

function parseIngredients(value: unknown): Array<{ quantidade: string; unidade: string; nome: string }> {
  if (Array.isArray(value)) return value as Array<{ quantidade: string; unidade: string; nome: string }>;
  if (typeof value !== "string") return [];

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const recipeId = Number(id);
    if (!Number.isInteger(recipeId) || recipeId <= 0) {
      return NextResponse.json({ error: "ID inválido" }, { status: 400 });
    }

    const rows = await sql<RecipeRow[]>`
      SELECT id, title, summary, ingredients_json
      FROM recipes
      WHERE id = ${recipeId}
      LIMIT 1
    `;
    if (rows.length === 0) {
      return NextResponse.json({ error: "Receita não encontrada" }, { status: 404 });
    }

    const recipe = rows[0];
    const generatedImage = await callGeminiImage({
      title: recipe.title,
      summary: recipe.summary,
      ingredients: parseIngredients(recipe.ingredients_json),
    });

    if (!generatedImage) {
      return NextResponse.json({ generated: false, generatedImage: null });
    }

    await sql`
      UPDATE recipes
      SET generated_image_data = ${generatedImage}
      WHERE id = ${recipeId}
    `;

    return NextResponse.json({ generated: true, generatedImage });
  } catch (error) {
    console.warn("POST /api/recipes/[id]/image failed:", error instanceof Error ? error.message : "unknown error");
    return NextResponse.json({ generated: false, generatedImage: null });
  }
}
