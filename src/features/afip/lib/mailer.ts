import "server-only";

import { eq } from "drizzle-orm";

import { db } from "@/db";
import { facturas } from "@/db/schema";
import { facturaCompleta } from "../queries";
import { pdfFactura } from "./pdf";

const API_URL = "https://api.resend.com/emails";

export type ResultadoEnvio = { ok: boolean; error?: string };

/**
 * Manda por mail el PDF de una factura ya emitida. No emite ni valida nada
 * fiscal (eso ya pasó) — solo arma el mail y lo manda. Deja registrado en
 * `facturas.enviada` / `envioError` el resultado, éxito o no.
 */
export async function enviarFacturaPorMail(facturaId: string): Promise<ResultadoEnvio> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM;
  if (!apiKey || !from) {
    return marcar(facturaId, { ok: false, error: "Envío de mail no configurado (falta RESEND_API_KEY)." });
  }

  const f = await facturaCompleta(facturaId);
  if (!f) return { ok: false, error: "Factura no encontrada." };
  if (!f.clienteEmail) {
    return marcar(facturaId, { ok: false, error: "El cliente no tiene email cargado." });
  }

  let pdf: Buffer;
  try {
    pdf = await pdfFactura(f);
  } catch (e) {
    return marcar(facturaId, { ok: false, error: `No se pudo armar el PDF: ${msg(e)}` });
  }

  const numeroFmt = `${String(f.puntoVenta).padStart(5, "0")}-${String(f.numero).padStart(8, "0")}`;
  const nombre = f.clienteNombre ?? "";

  const body = {
    from,
    to: [f.clienteEmail],
    subject: `Tu factura de Maitén Pets — Factura ${f.tipoComprobante} ${numeroFmt}`,
    html:
      `<p>Hola${nombre ? ` ${nombre}` : ""},</p>` +
      `<p>Te adjuntamos la Factura ${f.tipoComprobante} N.º ${numeroFmt} por tu compra en Maitén Pets, ` +
      `por un total de $${f.importeTotal.toLocaleString("es-AR", { minimumFractionDigits: 2 })}.</p>` +
      `<p>¡Gracias por elegirnos!</p>`,
    attachments: [
      { filename: `Factura_${f.tipoComprobante}_${numeroFmt}.pdf`, content: pdf.toString("base64") },
    ],
  };

  try {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const detalle = await res.text();
      return marcar(facturaId, { ok: false, error: `Resend ${res.status}: ${detalle.slice(0, 200)}` });
    }
  } catch (e) {
    return marcar(facturaId, { ok: false, error: `Fallo de red enviando el mail: ${msg(e)}` });
  }

  return marcar(facturaId, { ok: true });
}

async function marcar(facturaId: string, r: ResultadoEnvio): Promise<ResultadoEnvio> {
  await db
    .update(facturas)
    .set(
      r.ok
        ? { enviada: true, enviadaEn: new Date(), envioError: null }
        : { envioError: r.error ?? "Error desconocido" },
    )
    .where(eq(facturas.id, facturaId));
  return r;
}

function msg(e: unknown): string {
  return e instanceof Error ? e.message : "Fallo desconocido.";
}
