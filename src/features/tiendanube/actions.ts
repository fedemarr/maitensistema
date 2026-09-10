"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db } from "@/db";
import { integraciones } from "@/db/schema";
import { registrarAuditoria } from "@/lib/audit";
import { requireRole } from "@/lib/auth";
import { siteUrl } from "@/lib/url";
import {
  createWebhook,
  deleteWebhook,
  listWebhooks,
} from "./api";
import { credencialesTN, PROVEEDOR } from "./queries";
import { sincronizarStock } from "./sync";

export type ActionResult = { ok: true; msg?: string } | { ok: false; error: string };

const EVENTOS = ["order/created", "order/paid"];

/** (Re)registra los webhooks de pedidos en Tiendanube. */
export async function registrarWebhooks(): Promise<ActionResult> {
  await requireRole(["admin"]);
  const cred = await credencialesTN();
  if (!cred) return { ok: false, error: "La integración no está conectada." };

  const base = await siteUrl();
  const url = `${base}/api/tiendanube/webhook`;

  try {
    const actuales = await listWebhooks(cred.storeId, cred.token);
    for (const w of actuales) {
      if (w.url.includes("/api/tiendanube/webhook")) {
        await deleteWebhook(cred.storeId, cred.token, w.id);
      }
    }
    for (const ev of EVENTOS) {
      await createWebhook(cred.storeId, cred.token, ev, url);
    }
    revalidatePath("/config/integraciones");
    return { ok: true, msg: `Webhooks registrados (${EVENTOS.join(", ")}).` };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/** Dispara una sincronización de stock manual. */
export async function sincronizarAhora(): Promise<ActionResult> {
  await requireRole(["admin"]);
  try {
    const r = await sincronizarStock();
    revalidatePath("/config/integraciones");
    return {
      ok: true,
      msg: `Sync: ${r.actualizados} variantes actualizadas, ${r.sinMatch} sin match, ${r.errores} errores.`,
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/** Desconecta la integración (borra el token guardado). */
export async function desconectarTN(): Promise<ActionResult> {
  const user = await requireRole(["admin"]);
  await db
    .update(integraciones)
    .set({ estado: "desconectado", accessToken: null, storeId: null })
    .where(eq(integraciones.proveedor, PROVEEDOR));
  await registrarAuditoria({
    actorId: user.id,
    accion: "editar",
    entidad: "integracion",
    datos: { proveedor: PROVEEDOR, accion: "desconectar" },
  });
  revalidatePath("/config/integraciones");
  return { ok: true, msg: "Integración desconectada." };
}
