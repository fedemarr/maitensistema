import "server-only";

import { db } from "@/db";
import { auditoria } from "@/db/schema";

export type AccionAudit =
  | "crear"
  | "editar"
  | "borrar"
  | "login"
  | "logout"
  | "acceso_denegado";

type AuditInput = {
  actorId: string | null;
  accion: AccionAudit;
  entidad: string;
  entidadId?: string;
  datos?: unknown;
};

/** Registra un cambio o evento en la tabla de auditoría. No lanza si falla. */
export async function registrarAuditoria(input: AuditInput): Promise<void> {
  try {
    await db.insert(auditoria).values({
      actorId: input.actorId ?? null,
      accion: input.accion,
      entidad: input.entidad,
      entidadId: input.entidadId ?? null,
      datos: input.datos === undefined ? null : JSON.stringify(input.datos),
    });
  } catch (e) {
    console.error("No se pudo registrar auditoría:", e);
  }
}
