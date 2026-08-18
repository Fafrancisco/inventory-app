import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

const SAMPLE_STOCK = [
  ["Arroz", 5, 2, "Cozinha", "kg"],
  ["Azeite", 2, 1, "Cozinha", "L"],
  ["Detergente", 1, 2, "Casa de banho", "un"],
  ["Papel higiénico", 4, 6, "Casa de banho", "un"],
  ["Café", 3, 2, "Cozinha", "un"],
] as const;

const COMMON_RECIPE_PRODUCTS = [
  ["Arroz", "kg"],
  ["Esparguete", "kg"],
  ["Massa", "kg"],
  ["Feijão", "kg"],
  ["Grão-de-bico", "kg"],
  ["Lentilhas", "kg"],
  ["Farinha", "kg"],
  ["Açúcar", "kg"],
  ["Sal", "g"],
  ["Azeite", "L"],
  ["Óleo", "L"],
  ["Vinagre", "L"],
  ["Molho de tomate", "un"],
  ["Polpa de tomate", "un"],
  ["Atum", "un"],
  ["Sardinha", "un"],
  ["Leite", "L"],
  ["Manteiga", "un"],
  ["Ovos", "un"],
  ["Queijo", "un"],
  ["Iogurte", "un"],
  ["Pão", "un"],
  ["Tostas", "pac"],
  ["Alho", "un"],
  ["Cebola", "kg"],
  ["Batata", "kg"],
  ["Cenoura", "kg"],
  ["Tomate", "kg"],
  ["Alface", "un"],
  ["Pimento", "un"],
  ["Curgete", "kg"],
  ["Salsa", "un"],
  ["Coentros", "un"],
  ["Limão", "un"],
  ["Maçã", "kg"],
  ["Banana", "kg"],
  ["Legumes congelados", "kg"],
  ["Peixe congelado", "kg"],
] as const;

const SAMPLE_PRODUCTS = COMMON_RECIPE_PRODUCTS;

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const action = body.action;

    if (action === "reset") {
      if (body.confirmation !== "LIMPAR") {
        return NextResponse.json(
          { error: "Escreve LIMPAR para confirmar a operação." },
          { status: 400 }
        );
      }

      await sql`
        UPDATE stock_items
        SET quantidade = 0, updated_at = NOW()
      `;

      return NextResponse.json({ ok: true, message: "Quantidades limpas." });
    }

    if (action === "seed-inventory") {
      const result = await sql.begin(async (transaction) => {
        let productsInserted = 0;
        for (const [nome, unidade] of SAMPLE_PRODUCTS) {
          const productRows = await transaction`
            INSERT INTO products (nome, unidade)
            VALUES (${nome}, ${unidade})
            ON CONFLICT (nome) DO NOTHING
            RETURNING id
          `;
          productsInserted += productRows.length;
        }

        let inventoryInserted = 0;
        for (const [nome, quantidade, stockMinimo, localizacao, unidade] of SAMPLE_STOCK) {
          const stockRows = await transaction`
            INSERT INTO stock_items (nome, quantidade, stock_minimo, localizacao, unidade)
            SELECT ${nome}, ${quantidade}, ${stockMinimo}, ${localizacao}, ${unidade}
            WHERE NOT EXISTS (
              SELECT 1
              FROM stock_items
              WHERE stock_items.nome = ${nome}
                AND stock_items.quantidade = ${quantidade}
                AND stock_items.stock_minimo = ${stockMinimo}
                AND stock_items.localizacao = ${localizacao}
                AND stock_items.unidade = ${unidade}
            )
            RETURNING id
          `;
          inventoryInserted += stockRows.length;
        }

        await transaction`
          INSERT INTO app_meta (key, value)
          VALUES ('stock-sample-seed-v1', 'done')
          ON CONFLICT (key) DO NOTHING
        `;

        return {
          inserted: inventoryInserted,
          productsInserted,
          alreadySeeded: inventoryInserted === 0 && productsInserted === 0,
        };
      });

      return NextResponse.json({ ok: true, ...result });
    }

    return NextResponse.json({ error: "Ação de base de dados inválida." }, { status: 400 });
  } catch (error) {
    console.error("POST /api/config/database failed:", error);
    return NextResponse.json({ error: "Não foi possível atualizar a base de dados." }, { status: 500 });
  }
}
