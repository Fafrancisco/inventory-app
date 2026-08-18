import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

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
const STOCK_FILL = COMMON_RECIPE_PRODUCTS.map(([nome, unidade]) => [nome, 1, 1, "", unidade] as const);

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
        const productsAdded: string[] = [];
        for (const [nome, unidade] of SAMPLE_PRODUCTS) {
          const productRows = await transaction`
            INSERT INTO products (nome, unidade)
            VALUES (${nome}, ${unidade})
            ON CONFLICT (nome) DO NOTHING
            RETURNING id
          `;
          productsInserted += productRows.length;
          if (productRows.length > 0) productsAdded.push(nome);
        }

        let inventoryInserted = 0;
        let inventoryUpdated = 0;
        const inventoryAdded: string[] = [];
        const inventoryUpdatedNames: string[] = [];
        for (const [nome, quantidade, stockMinimo, localizacao, unidade] of STOCK_FILL) {
          const existingRows = await transaction`
            UPDATE stock_items
            SET quantidade = GREATEST(quantidade, ${quantidade}),
                updated_at = NOW()
            WHERE nome = ${nome}
            RETURNING id
          `;

          if (existingRows.length === 0) {
            const stockRows = await transaction`
              INSERT INTO stock_items (nome, quantidade, stock_minimo, localizacao, unidade)
              VALUES (${nome}, ${quantidade}, ${stockMinimo}, ${localizacao}, ${unidade})
              RETURNING id
            `;
            inventoryInserted += stockRows.length;
            if (stockRows.length > 0) inventoryAdded.push(nome);
          } else {
            inventoryUpdated += existingRows.length;
            inventoryUpdatedNames.push(nome);
          }
        }

        await transaction`
          INSERT INTO app_meta (key, value)
          VALUES ('stock-sample-seed-v1', 'done')
          ON CONFLICT (key) DO NOTHING
        `;

        return {
          inserted: inventoryInserted,
          updated: inventoryUpdated,
          productsInserted,
          productsAdded,
          inventoryAdded,
          inventoryUpdatedNames,
          alreadySeeded: inventoryInserted === 0 && inventoryUpdated === 0 && productsInserted === 0,
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
