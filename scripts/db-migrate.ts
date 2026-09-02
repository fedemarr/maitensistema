/**
 * Aplica las migraciones de drizzle/ que falten, en orden, cada archivo en una
 * transacción (rollback total si algo falla).
 *   pnpm db:migrate
 *
 * Reemplaza a `drizzle-kit migrate`, que en este entorno (drizzle-kit 0.31 +
 * postgres-js + pooler de Supabase) aborta silenciosamente al ver los NOTICE
 * de "schema drizzle already exists". Registra cada migración en
 * drizzle.__drizzle_migrations con el mismo hash que usa drizzle-kit.
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import postgres from "postgres";

type JournalEntry = { idx: number; tag: string; when: number };

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL no está seteada.");

const root = process.cwd();
const journal = JSON.parse(
  readFileSync(resolve(root, "drizzle/meta/_journal.json"), "utf8"),
) as { entries: JournalEntry[] };

const sql = postgres(process.env.DATABASE_URL, { prepare: false, max: 1 });

async function main() {
  await sql`create schema if not exists drizzle`;
  await sql`
    create table if not exists drizzle.__drizzle_migrations (
      id serial primary key,
      hash text not null,
      created_at bigint
    )
  `;

  const applied = await sql<{ hash: string }[]>`
    select hash from drizzle.__drizzle_migrations
  `;
  const appliedHashes = new Set(applied.map((r) => r.hash));

  const entries = [...journal.entries].sort((a, b) => a.idx - b.idx);
  let ran = 0;

  for (const e of entries) {
    const text = readFileSync(resolve(root, "drizzle", `${e.tag}.sql`), "utf8");
    const hash = createHash("sha256").update(text).digest("hex");
    if (appliedHashes.has(hash)) continue;

    const statements = text
      .split("--> statement-breakpoint")
      .map((s) => s.trim())
      .filter(Boolean);

    process.stdout.write(`→ ${e.tag} (${statements.length} stmts) … `);
    await sql.begin(async (tx) => {
      for (const stmt of statements) await tx.unsafe(stmt);
      await tx`
        insert into drizzle.__drizzle_migrations (hash, created_at)
        values (${hash}, ${e.when})
      `;
    });
    console.log("ok");
    ran++;
  }

  console.log(ran ? `${ran} migración(es) aplicada(s).` : "Nada pendiente.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => sql.end());
