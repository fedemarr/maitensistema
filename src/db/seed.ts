/**
 * Seed de desarrollo — datos de referencia de la spec §8 (Excel GESTION).
 *   pnpm db:seed
 * Idempotente por claves naturales (sku / nombre). No toca perfiles/auth.
 */
import { drizzle } from "drizzle-orm/postgres-js";
import { eq } from "drizzle-orm";
import postgres from "postgres";

import * as schema from "./schema";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL no está seteada.");

const client = postgres(process.env.DATABASE_URL, { prepare: false });
const db = drizzle(client, { schema, casing: "snake_case" });

type InsumoSeed = {
  key: string;
  nombre: string;
  unidad: "kg" | "u";
  ppp: number;
  reutilizable: boolean;
  vence?: boolean;
  stock: number;
};

// PPP del lote 2. Stock: valor redondo que cubre ~1 lote de 400 u para testear.
const INSUMOS: InsumoSeed[] = [
  { key: "lauril", nombre: "Lauril éter sulfato de sodio (25%)", unidad: "kg", ppp: 2921, reutilizable: true, stock: 80 },
  { key: "aloe", nombre: "Gel de aloe vera", unidad: "kg", ppp: 38609, reutilizable: false, vence: true, stock: 10 },
  { key: "cocoamido", nombre: "Cocoamido propil betaína", unidad: "kg", ppp: 9191, reutilizable: true, stock: 15 },
  { key: "glicerina", nombre: "Glicerina", unidad: "kg", ppp: 4275, reutilizable: true, stock: 12 },
  { key: "pantenol", nombre: "Pantenol (Dexpantenol)", unidad: "kg", ppp: 56929, reutilizable: true, vence: true, stock: 2 },
  { key: "fragRosa", nombre: "Fragancia rosa mosqueta", unidad: "kg", ppp: 37980, reutilizable: true, stock: 1.5 },
  { key: "rojo", nombre: "Rojo punzó 4R", unidad: "kg", ppp: 61060, reutilizable: true, stock: 0.5 },
  { key: "nacl", nombre: "Cloruro de sodio", unidad: "kg", ppp: 3561, reutilizable: true, stock: 3 },
  { key: "carbopol", nombre: "Carbopol 940", unidad: "kg", ppp: 41207, reutilizable: true, stock: 1.5 },
  { key: "euxyl", nombre: "Euxyl PE 9010", unidad: "kg", ppp: 63955, reutilizable: true, stock: 2 },
  { key: "dea", nombre: "Dietanolamina c.s.p. pH 5,5-6,5", unidad: "kg", ppp: 7105, reutilizable: true, stock: 1 },
  { key: "karite", nombre: "Manteca de karité", unidad: "kg", ppp: 29171, reutilizable: false, vence: true, stock: 4 },
  { key: "coco", nombre: "Aceite de coco neutro", unidad: "kg", ppp: 19309, reutilizable: false, vence: true, stock: 3 },
  { key: "calendula", nombre: "Aceite de caléndula", unidad: "kg", ppp: 24841, reutilizable: false, vence: true, stock: 3 },
  { key: "cera", nombre: "Cera de abejas", unidad: "kg", ppp: 32871, reutilizable: true, stock: 2 },
  { key: "almendras", nombre: "Aceite de almendras", unidad: "kg", ppp: 25038, reutilizable: false, vence: true, stock: 3 },
  { key: "fragAlm", nombre: "Fragancia almendras dulces", unidad: "kg", ppp: 28937, reutilizable: true, stock: 1 },
  { key: "alcohol", nombre: "Alcohol cetearílico", unidad: "kg", ppp: 8547, reutilizable: true, stock: 2 },
  { key: "vitE", nombre: "Vitamina E (acetato de alfa tocoferilo)", unidad: "kg", ppp: 81492, reutilizable: true, vence: true, stock: 0.5 },
  { key: "goma", nombre: "Goma xántica", unidad: "kg", ppp: 21128, reutilizable: true, stock: 0.5 },
  { key: "envSH", nombre: "Envase shampoo 250 ml", unidad: "u", ppp: 599.56, reutilizable: true, stock: 800 },
  { key: "envCR", nombre: "Envase crema 60 g", unidad: "u", ppp: 1494.43, reutilizable: true, stock: 800 },
  { key: "caja", nombre: "Cajas", unidad: "u", ppp: 511.41, reutilizable: true, stock: 1600 },
  { key: "etiq", nombre: "Etiquetas", unidad: "u", ppp: 179.75, reutilizable: true, stock: 800 },
];

const RECETA_SH: [string, number][] = [
  ["lauril", 0.1422], ["aloe", 0.0051], ["cocoamido", 0.0254], ["glicerina", 0.0076],
  ["pantenol", 0.0025], ["fragRosa", 0.0013], ["nacl", 0.0046], ["carbopol", 0.002],
  ["euxyl", 0.0013], ["dea", 0.001], ["envSH", 1], ["caja", 1], ["etiq", 1],
];
const RECETA_CR: [string, number][] = [
  ["karite", 0.0048], ["coco", 0.003], ["calendula", 0.003], ["cera", 0.0012],
  ["almendras", 0.003], ["glicerina", 0.003], ["fragAlm", 0.0001], ["alcohol", 0.0018],
  ["vitE", 0.0003], ["aloe", 0.003], ["euxyl", 0.0003], ["goma", 0.0003], ["envCR", 1], ["caja", 1],
];

async function main() {
  const { rubros, productos, recetas, recetaLineas, lotes, stockLotes, clientes } = schema;

  await db.insert(rubros).values([{ nombre: "Capilar" }, { nombre: "Corporal" }]).onConflictDoNothing();
  const capilar = await db.query.rubros.findFirst({ where: eq(rubros.nombre, "Capilar") });
  const corporal = await db.query.rubros.findFirst({ where: eq(rubros.nombre, "Corporal") });

  // Insumos (productos con es_insumo).
  const insumoId: Record<string, string> = {};
  for (const i of INSUMOS) {
    const sku = `INS-${i.key.toUpperCase()}`;
    const [row] = await db
      .insert(productos)
      .values({
        sku, nombre: i.nombre, esInsumo: true, unidad: i.unidad,
        reutilizable: i.reutilizable, vence: i.vence ?? false,
        ppp: String(i.ppp), stockInsumo: String(i.stock),
      })
      .onConflictDoUpdate({
        target: productos.sku,
        set: { ppp: String(i.ppp), stockInsumo: String(i.stock), reutilizable: i.reutilizable, vence: i.vence ?? false },
      })
      .returning({ id: productos.id });
    insumoId[i.key] = row.id;
  }

  // Terminados.
  const term = [
    { sku: "MAI-SH-AR-250", nombre: "Shampoo Aloe Vera y Rosa Mosqueta", rubroId: capilar?.id ?? null, pres: "250 ml", ppp: 3718, receta: RECETA_SH },
    { sku: "MAI-CR-CAL-060", nombre: "Crema Reparadora de Caléndula", rubroId: corporal?.id ?? null, pres: "60 g", ppp: 4308, receta: RECETA_CR },
  ];
  const prodId: Record<string, string> = {};
  for (const p of term) {
    const [row] = await db
      .insert(productos)
      .values({ sku: p.sku, nombre: p.nombre, rubroId: p.rubroId, presentacion: p.pres, stockMinimo: 50, online: true, ppp: String(p.ppp) })
      .onConflictDoUpdate({ target: productos.sku, set: { ppp: String(p.ppp) } })
      .returning({ id: productos.id });
    prodId[p.sku] = row.id;

    // Receta v1 vigente si no existe.
    const yaTiene = await db.query.recetas.findFirst({ where: eq(recetas.productoId, row.id) });
    if (!yaTiene) {
      const [rec] = await db
        .insert(recetas)
        .values({ productoId: row.id, numero: 1, vigenteDesde: "2026-01-01", notas: "Receta v1 (Excel ESTÁNDARES)" })
        .returning({ id: recetas.id });
      await db.insert(recetaLineas).values(
        p.receta.map(([k, q]) => ({
          recetaId: rec.id,
          insumoId: insumoId[k],
          cantidadPorUnidad: String(q),
          unidad: INSUMOS.find((x) => x.key === k)!.unidad,
        })),
      );
    }
  }

  // Lotes + stock por lote.
  const loteDefs = [
    { nombre: "Lote N.º 1", fecha: "2026-01-01" },
    { nombre: "Lote N.º 2", fecha: "2026-08-08" },
  ];
  const loteId: Record<string, string> = {};
  for (const l of loteDefs) {
    const [row] = await db
      .insert(lotes).values({ nombre: l.nombre, fecha: l.fecha })
      .onConflictDoNothing().returning({ id: lotes.id });
    loteId[l.nombre] = row?.id ?? (await db.query.lotes.findFirst({ where: eq(lotes.nombre, l.nombre) }))!.id;
  }

  const stockDefs = [
    { sku: "MAI-SH-AR-250", lote: "Lote N.º 1", u: 306 },
    { sku: "MAI-SH-AR-250", lote: "Lote N.º 2", u: 400 },
    { sku: "MAI-CR-CAL-060", lote: "Lote N.º 1", u: 2208 },
    { sku: "MAI-CR-CAL-060", lote: "Lote N.º 2", u: 400 },
  ];
  for (const s of stockDefs) {
    await db
      .insert(stockLotes)
      .values({ productoId: prodId[s.sku], loteId: loteId[s.lote], unidadesEnDeposito: s.u })
      .onConflictDoNothing();
  }

  // El tarifario de la fábrica (precios por producto + mínimo) se siembra en
  // la migración drizzle/0004 (spec v1.2 §3.3).

  // Clientes (solo si no hay ninguno).
  const hayClientes = await db.query.clientes.findFirst();
  if (!hayClientes) {
    await db.insert(clientes).values([
      { nombre: "Consumidor final (Tienda Nube)", tipo: "particular", notas: "Cliente genérico para ventas online sin identificar" },
      { nombre: "Veterinaria Los Pinos", tipo: "veterinaria", notas: "Trabaja en consignación." },
      { nombre: "Pet Shop Indicom", tipo: "pet_shop", notas: "Compra mayorista con 40% de descuento." },
      { nombre: "Distribuidora Zona Sur", tipo: "distribuidor" },
      { nombre: "Marca aliada (co-branding)", tipo: "marca_aliada" },
      { nombre: "Influencer / prensa", tipo: "prensa_influencer" },
    ]);
  }

  console.log("Seed OK: rubros, insumos, terminados + recetas v1, lotes + stock, precio fabricación, clientes.");
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => client.end());
