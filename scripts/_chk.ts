import postgres from "postgres";
async function attempt(n: number) {
  const sql = postgres(process.env.DATABASE_URL!, { prepare: false, max: 1, connect_timeout: 20 });
  try {
    const t = await sql`select table_name from information_schema.tables where table_schema='public' order by table_name`;
    console.log(`intento ${n}: OK · tablas public:`, t.map(r => r.table_name).join(", ") || "(ninguna)");
    return true;
  } catch (e) {
    console.log(`intento ${n}: fallo · ${(e as Error).message}`);
    return false;
  } finally {
    await sql.end();
  }
}
function wait(ms: number) { return new Promise((r) => setTimeout(r, ms)); }
async function main() {
  for (let i = 1; i <= 4; i++) {
    if (await attempt(i)) return;
    await wait(4000);
  }
}
main().catch((e) => console.error(e)).finally(() => process.exit(0));
