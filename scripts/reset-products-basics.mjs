import fs from "node:fs";
import path from "node:path";
import postgres from "postgres";

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const content = fs.readFileSync(filePath, "utf8");
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eqIdx = line.indexOf("=");
    if (eqIdx <= 0) continue;

    const key = line.slice(0, eqIdx).trim();
    let value = line.slice(eqIdx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

loadEnvFile(path.resolve(process.cwd(), ".env.local"));

const dbUrl = process.env.POSTGRES_URL;
if (!dbUrl) {
  console.error("POSTGRES_URL não encontrado. Define-o no ambiente ou em .env.local.");
  process.exit(1);
}

const essentials = [
  ["Arroz", "kg", "Mercearia"],
  ["Esparguete", "kg", "Mercearia"],
  ["Massa", "kg", "Mercearia"],
  ["Feijão", "kg", "Mercearia"],
  ["Grão-de-bico", "kg", "Mercearia"],
  ["Lentilhas", "kg", "Mercearia"],
  ["Farinha", "kg", "Mercearia"],
  ["Açúcar", "kg", "Mercearia"],
  ["Sal", "g", "Mercearia"],
  ["Azeite", "L", "Mercearia"],
  ["Óleo", "L", "Mercearia"],
  ["Vinagre", "L", "Mercearia"],
  ["Molho de tomate", "un", "Mercearia"],
  ["Polpa de tomate", "un", "Mercearia"],
  ["Atum", "un", "Mercearia"],
  ["Sardinha", "un", "Mercearia"],
  ["Mel", "un", "Mercearia"],
  ["Bolachas", "pac", "Mercearia"],
  ["Cereais", "pac", "Mercearia"],

  ["Leite", "L", "Laticínios"],
  ["Manteiga", "un", "Laticínios"],
  ["Ovos", "un", "Laticínios"],
  ["Queijo", "un", "Laticínios"],
  ["Iogurte", "un", "Laticínios"],

  ["Café", "kg", "Bebidas"],
  ["Chá", "un", "Bebidas"],
  ["Água", "L", "Bebidas"],
  ["Sumo", "L", "Bebidas"],

  ["Pão", "un", "Padaria"],
  ["Tostas", "pac", "Padaria"],

  ["Alho", "un", "Frescos"],
  ["Cebola", "kg", "Frescos"],
  ["Batata", "kg", "Frescos"],
  ["Cenoura", "kg", "Frescos"],
  ["Tomate", "kg", "Frescos"],
  ["Alface", "un", "Frescos"],
  ["Pimento", "un", "Frescos"],
  ["Curgete", "kg", "Frescos"],
  ["Salsa", "un", "Frescos"],
  ["Coentros", "un", "Frescos"],
  ["Limão", "un", "Frescos"],
  ["Maçã", "kg", "Frescos"],
  ["Banana", "kg", "Frescos"],

  ["Legumes congelados", "kg", "Congelados"],
  ["Peixe congelado", "kg", "Congelados"],

  ["Detergente loiça", "un", "Limpeza"],
  ["Detergente roupa", "kg", "Limpeza"],
  ["Amaciador", "L", "Limpeza"],
  ["Lixívia", "L", "Limpeza"],
  ["Desinfetante", "L", "Limpeza"],
  ["Limpa-vidros", "un", "Limpeza"],
  ["Esponjas", "un", "Limpeza"],
  ["Sacos de lixo", "pac", "Limpeza"],

  ["Papel higiénico", "un", "Higiene pessoal"],
  ["Champô", "un", "Higiene pessoal"],
  ["Gel de banho", "un", "Higiene pessoal"],
  ["Pasta de dentes", "un", "Higiene pessoal"],
  ["Desodorizante", "un", "Higiene pessoal"],
  ["Sabão", "un", "Higiene pessoal"],
  ["Fraldas", "pac", "Higiene pessoal"],

  ["Pilhas", "un", "Casa"],
  ["Papel de cozinha", "un", "Casa"],
];

const isLocalDb = /@(?:localhost|127\.0\.0\.1)(?::\d+)?\//i.test(dbUrl);
const sql = postgres(dbUrl, {
  max: 1,
  idle_timeout: 20,
  connect_timeout: 10,
  ssl: isLocalDb ? false : "require",
  prepare: false,
});

async function main() {
  try {
    const names = essentials.map(([nome]) => nome);

    await sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS localizacao_padrao VARCHAR(100)`;
    await sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS categoria VARCHAR(60)`;

    await sql.begin(async (tx) => {
      await tx`DELETE FROM products WHERE nome NOT IN ${tx(names)}`;

      for (const [nome, unidade, categoria] of essentials) {
        await tx`
          INSERT INTO products (nome, unidade, categoria)
          VALUES (${nome}, ${unidade}, ${categoria})
          ON CONFLICT (nome)
          DO UPDATE SET unidade = EXCLUDED.unidade, categoria = EXCLUDED.categoria
        `;
      }
    });

    const [{ total }] = await sql`SELECT COUNT(*)::int AS total FROM products`;
    console.log(`Catálogo reposto com sucesso. Produtos atuais: ${total}.`);
  } catch (error) {
    console.error("Falha ao repor catálogo básico:", error);
    process.exitCode = 1;
  } finally {
    await sql.end({ timeout: 5 });
  }
}

void main();
