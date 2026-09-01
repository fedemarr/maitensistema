import "server-only";

import { and, desc, eq, gte, lte, sql } from "drizzle-orm";

import { db } from "@/db";
import { asientoLineas, asientos, planCuentas } from "@/db/schema";
import { CUENTAS, TIPO_CUENTA } from "./schema";

/* ── Plan de cuentas con saldos ────────────────────────────── */

export type CuentaConSaldo = {
  id: string;
  codigo: string;
  nombre: string;
  rubro: string;
  tipo: (typeof TIPO_CUENTA)[number];
  activo: boolean;
  totalDebe: number;
  totalHaber: number;
  /** Saldo según la naturaleza de la cuenta (deudora o acreedora). */
  saldo: number;
};

function saldoDeTipo(
  tipo: CuentaConSaldo["tipo"],
  totalDebe: number,
  totalHaber: number,
): number {
  // Patrimonio, pasivos y resultados positivos son acreedores (saldo haber).
  return tipo === "activo" || tipo === "rneg"
    ? totalDebe - totalHaber
    : totalHaber - totalDebe;
}

export async function listPlanCuentas(): Promise<CuentaConSaldo[]> {
  const rows = await db
    .select({
      id: planCuentas.id,
      codigo: planCuentas.codigo,
      nombre: planCuentas.nombre,
      rubro: planCuentas.rubro,
      tipo: planCuentas.tipo,
      activo: planCuentas.activo,
      totalDebe: sql<string>`coalesce(sum(${asientoLineas.debe}), 0)::text`,
      totalHaber: sql<string>`coalesce(sum(${asientoLineas.haber}), 0)::text`,
    })
    .from(planCuentas)
    .leftJoin(asientoLineas, eq(asientoLineas.cuentaId, planCuentas.id))
    .groupBy(planCuentas.id)
    .orderBy(planCuentas.codigo);

  return rows.map((r) => {
    const totalDebe = Number(r.totalDebe);
    const totalHaber = Number(r.totalHaber);
    return {
      id: r.id,
      codigo: r.codigo,
      nombre: r.nombre,
      rubro: r.rubro,
      tipo: r.tipo,
      activo: r.activo,
      totalDebe,
      totalHaber,
      saldo: saldoDeTipo(r.tipo, totalDebe, totalHaber),
    };
  });
}

/** Cuentas clave para el hub de contabilidad (Caja, Banco, Deudores, Proveedores). */
export async function saldosClave() {
  const cuentas = await listPlanCuentas();
  const porCodigo = new Map(cuentas.map((c) => [c.codigo, c]));
  const clave = (codigo: (typeof CUENTAS)[keyof typeof CUENTAS]) =>
    porCodigo.get(codigo) ?? null;
  return {
    caja: clave(CUENTAS.caja),
    banco: clave(CUENTAS.banco),
    mercaderia: clave(CUENTAS.mercaderia),
    mercaderiaConsignacion: clave(CUENTAS.mercaderiaConsignacion),
    deudores: clave(CUENTAS.deudoresPorVentas),
    proveedores: clave(CUENTAS.proveedoresAPagar),
  };
}

/* ── Balance de comprobación / balance general ─────────────── */

export async function balanceComprobacion() {
  const porCuenta = await listPlanCuentas();
  const totalDebe = porCuenta.reduce((a, c) => a + c.totalDebe, 0);
  const totalHaber = porCuenta.reduce((a, c) => a + c.totalHaber, 0);

  // Totales por tipo (para el balance general).
  const porTipo = {} as Record<CuentaConSaldo["tipo"], number>;
  for (const t of TIPO_CUENTA) porTipo[t] = 0;
  for (const c of porCuenta) {
    if (c.activo) porTipo[c.tipo] += saldoDeTipo(c.tipo, c.totalDebe, c.totalHaber);
  }

  return {
    porCuenta,
    totalDebe,
    totalHaber: totalHaber,
    descuadre: Math.abs(totalDebe - totalHaber) > 0.005,
    porTipo,
  };
}

/* ── Estado de resultados ──────────────────────────────────── */

export type ResultadoCuenta = {
  cuentaId: string;
  codigo: string;
  nombre: string;
  tipo: "rpos" | "rneg";
  debe: number;
  haber: number;
  neto: number;
};

export async function estadoResultados(desde: string, hasta: string) {
  const rows = await db
    .select({
      cuentaId: planCuentas.id,
      codigo: planCuentas.codigo,
      nombre: planCuentas.nombre,
      tipo: planCuentas.tipo,
      debe: sql<string>`coalesce(sum(${asientoLineas.debe}), 0)::text`,
      haber: sql<string>`coalesce(sum(${asientoLineas.haber}), 0)::text`,
    })
    .from(asientos)
    .innerJoin(asientoLineas, eq(asientoLineas.asientoId, asientos.id))
    .innerJoin(planCuentas, eq(planCuentas.id, asientoLineas.cuentaId))
    .where(
      and(
        gte(asientos.fecha, desde),
        lte(asientos.fecha, hasta),
        sql`${planCuentas.tipo} in ('rpos', 'rneg')`,
      ),
    )
    .groupBy(planCuentas.id)
    .orderBy(planCuentas.codigo);

  const cuentas: ResultadoCuenta[] = rows.map((r) => {
    const debe = Number(r.debe);
    const haber = Number(r.haber);
    const tipo = r.tipo as "rpos" | "rneg";
    const neto = tipo === "rpos" ? haber - debe : debe - haber;
    return {
      cuentaId: r.cuentaId,
      codigo: r.codigo,
      nombre: r.nombre,
      tipo,
      debe,
      haber,
      neto,
    };
  });

  const ingresos = cuentas
    .filter((c) => c.tipo === "rpos")
    .reduce((a, c) => a + c.neto, 0);
  const gastos = cuentas
    .filter((c) => c.tipo === "rneg")
    .reduce((a, c) => a + c.neto, 0);

  return { cuentas, ingresos, gastos, resultado: ingresos - gastos };
}

/* ── Asientos ──────────────────────────────────────────────── */

export async function listAsientos() {
  const rows = await db
    .select({
      id: asientos.id,
      fecha: asientos.fecha,
      descripcion: asientos.descripcion,
      origen: asientos.origen,
      estado: asientos.estado,
      movimientoId: asientos.movimientoId,
      totalDebe: sql<string>`coalesce(sum(${asientoLineas.debe}), 0)::text`,
      totalHaber: sql<string>`coalesce(sum(${asientoLineas.haber}), 0)::text`,
      nlineas: sql<number>`count(${asientoLineas.id})::int`,
    })
    .from(asientos)
    .leftJoin(asientoLineas, eq(asientoLineas.asientoId, asientos.id))
    .groupBy(asientos.id)
    .orderBy(desc(asientos.fecha), desc(asientos.createdAt));

  return rows.map((r) => ({
    id: r.id,
    fecha: r.fecha,
    descripcion: r.descripcion,
    origen: r.origen,
    estado: r.estado,
    movimientoId: r.movimientoId,
    totalDebe: Number(r.totalDebe),
    totalHaber: Number(r.totalHaber),
    nlineas: r.nlineas,
    balanced: Math.abs(Number(r.totalDebe) - Number(r.totalHaber)) < 0.005,
  }));
}

export type AsientoListItem = Awaited<ReturnType<typeof listAsientos>>[number];

export async function getAsiento(id: string) {
  const asiento = await db.query.asientos.findFirst({
    where: eq(asientos.id, id),
    with: {
      movimiento: {
        columns: { id: true, tipo: true, total: true, fecha: true, notas: true },
      },
      creador: { columns: { nombre: true } },
      lineas: {
        with: { cuenta: { columns: { codigo: true, nombre: true, tipo: true } } },
      },
    },
  });

  const totalDebe = (asiento?.lineas ?? []).reduce(
    (a, l) => a + Number(l.debe),
    0,
  );
  const totalHaber = (asiento?.lineas ?? []).reduce(
    (a, l) => a + Number(l.haber),
    0,
  );

  return asiento
    ? {
        ...asiento,
        totalDebe,
        totalHaber,
        balanced: Math.abs(totalDebe - totalHaber) < 0.005,
      }
    : null;
}