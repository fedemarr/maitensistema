import "server-only";

import { asc, eq } from "drizzle-orm";

import { db } from "@/db";
import { rubros } from "@/db/schema";

export async function listRubros(soloActivos = false) {
  return db.query.rubros.findMany({
    where: soloActivos ? eq(rubros.activo, true) : undefined,
    orderBy: (r) => [asc(r.nombre)],
  });
}

export type Rubro = Awaited<ReturnType<typeof listRubros>>[number];
