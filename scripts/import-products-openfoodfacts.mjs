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

const limitArg = process.argv.find((arg) => arg.startsWith("--limit="));
const pageLimitArg = process.argv.find((arg) => arg.startsWith("--pages="));
const maxProducts = limitArg ? Number(limitArg.split("=")[1]) : 800;
const maxPages = pageLimitArg ? Number(pageLimitArg.split("=")[1]) : 20;

if (!Number.isInteger(maxProducts) || maxProducts <= 0) {
  console.error("--limit must be a positive integer");
  process.exit(1);
}

if (!Number.isInteger(maxPages) || maxPages <= 0) {
  console.error("--pages must be a positive integer");
  process.exit(1);
}

function normalizeName(name) {
  return name
    .replace(/\s*[-|]\s*(continente|auchan|pingo doce|intermarche|mercadona).*$/i, "")
    .replace(/\s*\([^)]*\)\s*$/g, "")
    .replace(/\s+/g, " ")
    .replace(/[\u0000-\u001F\u007F]/g, "")
    .trim();
}

function inferCategory(name) {
  const n = name.toLowerCase();

  const rules = [
    ["Frutas e Legumes", /\b(ma[cç][aã]|banana|pera|laranja|tangerina|kiwi|abacate|uva|morango|batata|cebola|alho|tomate|cenoura|alface|brocolos|br[oó]colos|espinafres|pepino|courgette|ab[oó]bora)\b/],
    ["Carne e Peixe", /\b(frango|peru|vaca|porco|bife|hamb[úu]rguer|salsicha|chouri[cç]o|atum|sardinha|bacalhau|salm[aã]o|dourada|pescada|peixe)\b/],
    ["Laticínios e Ovos", /\b(leite|queijo|iogurte|manteiga|natas|requeij[aã]o|ovo|ovos)\b/],
    ["Padaria e Cereais", /\b(p[aã]o|tosta|bolacha|cereais|granola|farinha|aveia|arroz|massa|esparguete)\b/],
    ["Bebidas", /\b([aá]gua|sumo|refrigerante|cola|icer tea|iced tea|caf[eé]|ch[aá]|vinho|cerveja)\b/],
    ["Congelados", /\b(congelado|congelada|gelado|ultracongelado)\b/],
    ["Despensa", /\b(a[cç][uú]car|sal|azeite|[oó]leo|vinagre|feij[aã]o|gr[aã]o|lentilhas|molho|polpa|mel|atum|sardinha)\b/],
    ["Limpeza", /\b(detergente|amaciador|lix[ií]via|desinfetante|limpa|esponja|saco de lixo|sacos de lixo)\b/],
    ["Higiene Pessoal", /\b(champ[oô]|gel de banho|pasta de dentes|desodorizante|sab[aã]o|fraldas|papel hig[ié]nico)\b/],
    ["Casa", /\b(pilhas|papel de cozinha|guardanapos|alum[ií]nio|pel[ií]cula aderente)\b/],
  ];

  for (const [category, re] of rules) {
    if (re.test(n)) return category;
  }

  return "Outros";
}

async function fetchProductsPage(page) {
  const url = new URL("https://world.openfoodfacts.org/cgi/search.pl");
  url.searchParams.set("search_simple", "1");
  url.searchParams.set("action", "process");
  url.searchParams.set("json", "1");
  url.searchParams.set("page_size", "100");
  url.searchParams.set("page", String(page));
  url.searchParams.set("sort_by", "unique_scans_n");
  url.searchParams.set("fields", "product_name,product_name_pt");
  url.searchParams.set("tagtype_0", "countries");
  url.searchParams.set("tag_contains_0", "contains");
  url.searchParams.set("tag_0", "portugal");
  url.searchParams.set("tagtype_1", "languages");
  url.searchParams.set("tag_contains_1", "contains");
  url.searchParams.set("tag_1", "portuguese");

  const maxRetries = 4;
  for (let attempt = 1; attempt <= maxRetries; attempt += 1) {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "inventory-app/1.0 (local importer)",
        Accept: "application/json",
      },
    });

    if (res.ok) {
      const data = await res.json();
      return Array.isArray(data.products) ? data.products : [];
    }

    if ((res.status === 429 || res.status >= 500) && attempt < maxRetries) {
      const waitMs = 400 * attempt;
      await new Promise((resolve) => setTimeout(resolve, waitMs));
      continue;
    }

    throw new Error(`Open Food Facts request failed on page ${page}: ${res.status}`);
  }

  return [];
}

async function ensureProductsSchema() {
  await sql`
    CREATE TABLE IF NOT EXISTS products (
      id SERIAL PRIMARY KEY,
      nome VARCHAR(255) NOT NULL UNIQUE,
      unidade VARCHAR(20) NOT NULL DEFAULT 'un',
      localizacao_padrao VARCHAR(100),
      categoria VARCHAR(60),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
    ALTER TABLE products
    ADD COLUMN IF NOT EXISTS categoria VARCHAR(60)
  `;
}

async function main() {
  try {
    await ensureProductsSchema();

    const names = new Set();

    for (let page = 1; page <= maxPages && names.size < maxProducts; page += 1) {
      let products = [];
      try {
        products = await fetchProductsPage(page);
      } catch (error) {
        console.warn(`Skipping page ${page} due to fetch errors: ${error.message}`);
        continue;
      }

      for (const p of products) {
        const candidate = p.product_name_pt || p.product_name || "";
        const name = normalizeName(String(candidate));

        if (!name) continue;
        if (name.length < 2 || name.length > 255) continue;
        if (/^[0-9\W_]+$/.test(name)) continue;

        names.add(name);
        if (names.size >= maxProducts) break;
      }

      if (products.length === 0) break;

      // Be polite with the upstream API.
      await new Promise((resolve) => setTimeout(resolve, 120));
    }

    const list = Array.from(names).sort((a, b) => a.localeCompare(b, "pt"));

    if (list.length === 0) {
      console.log("No products found to import.");
      return;
    }

    await sql.begin(async (tx) => {
      for (const nome of list) {
        const categoria = inferCategory(nome);
        await tx`
          INSERT INTO products (nome, unidade, categoria)
          VALUES (${nome}, 'un', ${categoria})
          ON CONFLICT (nome) DO NOTHING
        `;
      }
    });

    const [{ count }] = await sql`SELECT COUNT(*)::int AS count FROM products`;
    console.log(`Imported up to ${list.length} products from Open Food Facts.`);
    console.log(`Current total products in DB: ${count}`);
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
