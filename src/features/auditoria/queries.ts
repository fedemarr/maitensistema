import "server-only";

import { and, desc, eq, gte, lte, sql } from "drizzle-orm";

import { db } from "@/db";
import { auditoria, perfiles } from "@/db/schema";
import type { Accion } from "./schema";

export type FiltroAuditoria = {
  usuarioId?: string;
  entidad?: string;
  accion?: Accion;
  desde?: string; // YYYY-MM-DD
  hasta?: string; // YYYY-MM-DD
  pagina?: number;
};

const PAGE = 50;

export type EventoAuditoria = {
  id: string;
  fecha: string;
  actor: string | null;
  accion: string;
  entidad: string;
  entidadId: string | null;
  datos: unknown;
};

export async function listAuditoria(f: FiltroAuditoria = {}): Promise<{
  eventos: EventoAuditoria[];
  total: number;
  pagina: number;
  paginas: number;
}> {
  const cond = [];
  if (f.usuarioId) cond.push(eq(auditoria.actorId, f.usuarioId));
  if (f.entidad) cond.push(eq(auditoria.entidad, f.entidad));
  if (f.accion) cond.push(eq(auditoria.accion, f.accion));
  if (f.desde) cond.push(gte(auditoria.createdAt, new Date(`${f.desde}T00:00:00`)));
  if (f.hasta) cond.push(lte(auditoria.createdAt, new Date(`${f.hasta}T23:59:59`)));
  const where = cond.length ? and(...cond) : undefined;

  const pagina = Math.max(1, f.pagina ?? 1);

  const [{ n }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(auditoria)
    .where(where);

  const rows = await db
    .select({
      id: auditoria.id,
      fecha: auditoria.createdAt,
      actor: perfiles.nombre,
      accion: auditoria.accion,
      entidad: auditoria.entidad,
      entidadId: auditoria.entidadId,
      datos: auditoria.datos,
    })
    .from(auditoria)
    .leftJoin(perfiles, eq(perfiles.id, auditoria.actorId))
    .where(where)
    .orderBy(desc(auditoria.createdAt))
    .limit(PAGE)
    .offset((pagina - 1) * PAGE);

  return {
    eventos: rows.map((r) => ({
      id: r.id,
      fecha: r.fecha.toISOString(),
      actor: r.actor,
      accion: r.accion,
      entidad: r.entidad,
      entidadId: r.entidadId,
      datos: r.datos ? safeParse(r.datos) : null,
    })),
    total: n,
    pagina,
    paginas: Math.max(1, Math.ceil(n / PAGE)),
  };
}

function safeParse(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return s;
  }
}

export async function filtrosAuditoria() {
  const [entidades, usuarios] = await Promise.all([
    db
      .selectDistinct({ e: auditoria.entidad })
      .from(auditoria)
      .orderBy(auditoria.entidad),
    db
      .select({ id: perfiles.id, nombre: perfiles.nombre })
      .from(perfiles)
      .orderBy(perfiles.nombre),
  ]);
  return {
    entidades: entidades.map((r) => r.e),
    usuarios,
  };
}

export async function resumenSeguridad() {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const semana = new Date(Date.now() - 7 * 24 * 3600 * 1000);

  const [totales, denegados7d, porUsuario, porAccion, ultimoLogin] =
    await Promise.all([
      db
        .select({
          hoy: sql<number>`count(*) filter (where ${auditoria.createdAt} >= ${hoy.toISOString()})::int`,
          semana: sql<number>`count(*) filter (where ${auditoria.createdAt} >= ${semana.toISOString()})::int`,
          total: sql<number>`count(*)::int`,
        })
        .from(auditoria),
      db
        .select({ n: sql<number>`count(*)::int` })
        .from(auditoria)
        .where(
          and(
            eq(auditoria.accion, "acceso_denegado"),
            gte(auditoria.createdAt, semana),
          ),
        ),
      db
        .select({
          nombre: perfiles.nombre,
          n: sql<number>`count(*)::int`,
        })
        .from(auditoria)
        .leftJoin(perfiles, eq(perfiles.id, auditoria.actorId))
        .where(gte(auditoria.createdAt, semana))
        .groupBy(perfiles.nombre)
        .orderBy(desc(sql`count(*)`)),
      db
        .select({ accion: auditoria.accion, n: sql<number>`count(*)::int` })
        .from(auditoria)
        .where(gte(auditoria.createdAt, semana))
        .groupBy(auditoria.accion),
      db
        .select({ fecha: auditoria.createdAt, actor: perfiles.nombre })
        .from(auditoria)
        .leftJoin(perfiles, eq(perfiles.id, auditoria.actorId))
        .where(eq(auditoria.accion, "login"))
        .orderBy(desc(auditoria.createdAt))
        .limit(1),
    ]);

  return {
    hoy: totales[0]?.hoy ?? 0,
    semana: totales[0]?.semana ?? 0,
    total: totales[0]?.total ?? 0,
    accesosDenegados7d: denegados7d[0]?.n ?? 0,
    porUsuario: porUsuario.map((r) => ({ nombre: r.nombre ?? "—", n: r.n })),
    porAccion: Object.fromEntries(porAccion.map((r) => [r.accion, r.n])),
    ultimoLogin: ultimoLogin[0]
      ? {
          fecha: ultimoLogin[0].fecha.toISOString(),
          actor: ultimoLogin[0].actor ?? "—",
        }
      : null,
  };
}
