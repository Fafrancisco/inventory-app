#!/usr/bin/env node
import postgres from "postgres";

const dbUrl = process.env.POSTGRES_URL;
if (!dbUrl) {
  console.error("POSTGRES_URL is not set.");
  process.exit(1);
}

const sql = postgres(dbUrl, {
  max: 1,
  idle_timeout: 20,
  connect_timeout: 10,
  ssl: dbUrl.includes("localhost") || dbUrl.includes("127.0.0.1") ? false : "require",
  prepare: false,
});

try {
  await sql.begin(async (transaction) => {
    const lockRows = await transaction`
      INSERT INTO app_meta (key, value)
      VALUES ('stock-sample-seed-v1', 'done')
      ON CONFLICT (key) DO NOTHING
      RETURNING key
    `;

    if (lockRows.length === 0) {
      console.log("Sample stock was already seeded; nothing to do.");
      return;
    }

    await transaction`
      INSERT INTO stock_items (nome, quantidade, stock_minimo, localizacao, unidade)
      VALUES
        ('Arroz', 5, 2, 'Cozinha', 'kg'),
        ('Azeite', 2, 1, 'Cozinha', 'L'),
        ('Detergente', 1, 2, 'Casa de banho', 'un'),
        ('Papel higiénico', 4, 6, 'Casa de banho', 'un'),
        ('Café', 3, 2, 'Cozinha', 'un')
    `;

    console.log("Sample stock seeded successfully.");
  });
} finally {
  await sql.end({ timeout: 5 });
}
