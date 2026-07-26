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

const dryRun = process.argv.includes("--dry-run");

function normalizeName(name) {
  return name
    .normalize("NFD")
    .replace(/\p{Diacritic}+/gu, "")
    .toLowerCase()
    .replace(/\s*[-|]\s*(continente|auchan|pingo doce|intermarche|mercadona).*$/i, "")
    .replace(/\b\d+[\d.,]*\s?(g|kg|ml|l|cl|un|und|cx|pack|pac)\b/g, "")
    .replace(/[()\[\]{}]/g, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokens(name) {
  const stop = new Set([
    "de", "do", "da", "dos", "das", "com", "sem", "para", "e", "o", "a", "os", "as",
    "tipo", "extra", "super", "pack", "pacote", "un", "und",
  ]);

  return normalizeName(name)
    .split(" ")
    .filter((t) => t.length > 1 && !stop.has(t));
}

function jaccard(a, b) {
  const sa = new Set(a);
  const sb = new Set(b);
  if (sa.size === 0 && sb.size === 0) return 1;

  let inter = 0;
  for (const t of sa) {
    if (sb.has(t)) inter += 1;
  }
  const uni = sa.size + sb.size - inter;
  return uni === 0 ? 0 : inter / uni;
}

function similar(a, b) {
  if (a.clean === b.clean) return true;

  const tA = a.tokens;
  const tB = b.tokens;
  if (tA.length === 0 || tB.length === 0) return false;

  const jac = jaccard(tA, tB);
  if (jac >= 0.93 && Math.abs(tA.length - tB.length) <= 1) return true;

  if ((a.clean.startsWith(b.clean) || b.clean.startsWith(a.clean)) && Math.abs(a.clean.length - b.clean.length) <= 4) {
    return true;
  }

  return false;
}

function inferCategory(name) {
  const n = name.toLowerCase();

  const rules = [
    ["Frutas e Legumes", /\b(ma[cç][aã]|banana|pera|laranja|tangerina|kiwi|abacate|uva|morango|batata|cebola|alho|tomate|cenoura|alface|brocolos|br[oó]colos|espinafres|pepino|courgette|ab[oó]bora)\b/],
    ["Carne e Peixe", /\b(frango|peru|vaca|porco|bife|hamb[úu]rguer|salsicha|chouri[cç]o|atum|sardinha|bacalhau|salm[aã]o|dourada|pescada|peixe)\b/],
    ["Laticínios e Ovos", /\b(leite|queijo|iogurte|manteiga|natas|requeij[aã]o|ovo|ovos)\b/],
    ["Padaria e Cereais", /\b(p[aã]o|tosta|bolacha|cereais|granola|farinha|aveia|arroz|massa|esparguete)\b/],
    ["Bebidas", /\b([aá]gua|sumo|refrigerante|cola|ice tea|iced tea|caf[eé]|ch[aá]|vinho|cerveja)\b/],
    ["Congelados", /\b(congelado|congelada|gelado|ultracongelado)\b/],
    ["Despensa", /\b(a[cç][uú]car|sal|azeite|[oó]leo|vinagre|feij[aã]o|gr[aã]o|lentilhas|molho|polpa|mel)\b/],
    ["Limpeza", /\b(detergente|amaciador|lix[ií]via|desinfetante|limpa|esponja|saco de lixo|sacos de lixo)\b/],
    ["Higiene Pessoal", /\b(champ[oô]|gel de banho|pasta de dentes|desodorizante|sab[aã]o|fraldas|papel hig[ié]nico)\b/],
    ["Casa", /\b(pilhas|papel de cozinha|guardanapos|alum[ií]nio|pel[ií]cula aderente)\b/],
  ];

  for (const [category, re] of rules) {
    if (re.test(n)) return category;
  }

  return "Outros";
}

class DSU {
  constructor(n) {
    this.p = Array.from({ length: n }, (_, i) => i);
  }
  find(x) {
    while (this.p[x] !== x) {
      this.p[x] = this.p[this.p[x]];
      x = this.p[x];
    }
    return x;
  }
  union(a, b) {
    const ra = this.find(a);
    const rb = this.find(b);
    if (ra !== rb) this.p[rb] = ra;
  }
}

async function ensureSchema() {
  await sql`
    ALTER TABLE products
    ADD COLUMN IF NOT EXISTS categoria VARCHAR(60)
  `;
}

function chooseCanonical(group) {
  return group.slice().sort((a, b) => {
    const aScore = a.nome.length;
    const bScore = b.nome.length;
    if (aScore !== bScore) return aScore - bScore;
    return a.id - b.id;
  })[0];
}

async function main() {
  try {
    await ensureSchema();

    const rows = await sql`SELECT id, nome FROM products ORDER BY id ASC`;
    const records = rows.map((r) => ({
      id: r.id,
      nome: r.nome,
      clean: normalizeName(r.nome),
      tokens: tokens(r.nome),
    }));

    const dsu = new DSU(records.length);
    for (let i = 0; i < records.length; i += 1) {
      for (let j = i + 1; j < records.length; j += 1) {
        if (similar(records[i], records[j])) {
          dsu.union(i, j);
        }
      }
    }

    const groups = new Map();
    for (let i = 0; i < records.length; i += 1) {
      const root = dsu.find(i);
      if (!groups.has(root)) groups.set(root, []);
      groups.get(root).push(records[i]);
    }

    const toDelete = [];
    let clusterCount = 0;
    for (const group of groups.values()) {
      if (group.length <= 1) continue;
      clusterCount += 1;
      const canonical = chooseCanonical(group);
      for (const rec of group) {
        if (rec.id !== canonical.id) {
          toDelete.push(rec.id);
        }
      }
    }

    if (dryRun) {
      console.log(`Dry-run: found ${clusterCount} similarity clusters.`);
      console.log(`Dry-run: would delete ${toDelete.length} duplicate rows.`);
    } else {
      await sql.begin(async (tx) => {
        for (const id of toDelete) {
          await tx`DELETE FROM products WHERE id = ${id}`;
        }

        const remaining = await tx`SELECT id, nome FROM products`;
        for (const p of remaining) {
          const categoria = inferCategory(p.nome);
          await tx`
            UPDATE products
            SET categoria = ${categoria}
            WHERE id = ${p.id}
          `;
        }
      });

      const [{ count }] = await sql`SELECT COUNT(*)::int AS count FROM products`;
      const catRows = await sql`
        SELECT categoria, COUNT(*)::int AS total
        FROM products
        GROUP BY categoria
        ORDER BY total DESC, categoria ASC
      `;

      console.log(`Merged duplicate rows: ${toDelete.length}`);
      console.log(`Similarity clusters merged: ${clusterCount}`);
      console.log(`Current total products: ${count}`);
      console.log("Categories:");
      for (const row of catRows) {
        console.log(`- ${row.categoria}: ${row.total}`);
      }
    }
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
