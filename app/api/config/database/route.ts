import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

const SAMPLE_STOCK = [
  ["Arroz", 5, 2, "Cozinha", "kg"],
  ["Azeite", 2, 1, "Cozinha", "L"],
  ["Detergente", 1, 2, "Casa de banho", "un"],
  ["Papel higiénico", 4, 6, "Casa de banho", "un"],
  ["Café", 3, 2, "Cozinha", "un"],
] as const;

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const action = body.action;

    if (action === "reset") {
      if (body.confirmation !== "APAGAR") {
        return NextResponse.json(
          { error: "Escreve APAGAR para confirmar a eliminação." },
          { status: 400 }
        );
      }

      await sql.begin(async (transaction) => {
        await transaction`
          TRUNCATE TABLE
            recipe_ingredients,
            recipes,
            recipe_preferences,
            stock_items,
            products,
            app_meta
          RESTART IDENTITY CASCADE
        `;
      });

      return NextResponse.json({ ok: true, message: "Base de dados limpa." });
    }

    if (action === "seed-inventory") {
      const result = await sql.begin(async (transaction) => {
        const seedLock = await transaction`
          INSERT INTO app_meta (key, value)
          VALUES ('stock-sample-seed-v1', 'done')
          ON CONFLICT (key) DO NOTHING
          RETURNING key
        `;

        if (seedLock.length === 0) {
          return { inserted: 0, alreadySeeded: true };
        }

        for (const [nome, quantidade, stockMinimo, localizacao, unidade] of SAMPLE_STOCK) {
          await transaction`
            INSERT INTO stock_items (nome, quantidade, stock_minimo, localizacao, unidade)
            VALUES (${nome}, ${quantidade}, ${stockMinimo}, ${localizacao}, ${unidade})
          `;
        }

        return { inserted: SAMPLE_STOCK.length, alreadySeeded: false };
      });

      return NextResponse.json({ ok: true, ...result });
    }

    return NextResponse.json({ error: "Ação de base de dados inválida." }, { status: 400 });
  } catch (error) {
    console.error("POST /api/config/database failed:", error);
    return NextResponse.json({ error: "Não foi possível atualizar a base de dados." }, { status: 500 });
  }
}
