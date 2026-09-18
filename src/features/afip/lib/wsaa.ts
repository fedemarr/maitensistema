import "server-only";

import forge from "node-forge";
import { XMLParser } from "fast-xml-parser";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { integraciones } from "@/db/schema";
import { soapPost } from "./soap";

const PROVEEDOR = "afip";
const WSAA_URL =
  process.env.AFIP_WSAA_URL ?? "https://wsaa.afip.gov.ar/ws/services/LoginCms";

const parser = new XMLParser({ ignoreAttributes: false, removeNSPrefix: true });

export type CredencialesAfip = { cert: string; key: string; cuit: string };

export function credencialesAfip(): CredencialesAfip {
  const certB64 = process.env.AFIP_CERT_B64;
  const keyB64 = process.env.AFIP_KEY_B64;
  const cuit = process.env.AFIP_CUIT;
  if (!certB64 || !keyB64 || !cuit) {
    throw new Error(
      "Faltan credenciales AFIP (AFIP_CERT_B64 / AFIP_KEY_B64 / AFIP_CUIT).",
    );
  }
  return {
    cert: Buffer.from(certB64, "base64").toString("utf8"),
    key: Buffer.from(keyB64, "base64").toString("utf8"),
    cuit,
  };
}

/** Fecha/hora en formato AFIP (ISO con offset de Argentina, UTC-3 fijo). */
function fechaArg(epochMs: number): string {
  const d = new Date(epochMs - 3 * 3600_000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}` +
    `T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}-03:00`
  );
}

/** Firma el TRA (Ticket de Requerimiento de Acceso) como CMS/PKCS#7 adjunto. */
function firmarTra(traXml: string, cert: string, key: string): string {
  const p7 = forge.pkcs7.createSignedData();
  p7.content = forge.util.createBuffer(traXml, "utf8");
  p7.addCertificate(cert);
  p7.addSigner({
    key: forge.pki.privateKeyFromPem(key),
    certificate: cert,
    digestAlgorithm: forge.pki.oids.sha256,
    authenticatedAttributes: [
      { type: forge.pki.oids.contentType, value: forge.pki.oids.data },
      { type: forge.pki.oids.messageDigest },
      { type: forge.pki.oids.signingTime, value: new Date() as unknown as string },
    ],
  });
  p7.sign({ detached: false });
  const der = forge.asn1.toDer(p7.toAsn1()).getBytes();
  return forge.util.encode64(der);
}

async function loginWsaa(
  service: string,
): Promise<{ token: string; sign: string; expira: string }> {
  const { cert, key } = credencialesAfip();
  const now = Date.now();

  const tra =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<loginTicketRequest version="1.0">\n` +
    `  <header>\n` +
    `    <uniqueId>${Math.floor(now / 1000)}</uniqueId>\n` +
    `    <generationTime>${fechaArg(now - 600_000)}</generationTime>\n` +
    `    <expirationTime>${fechaArg(now + 600_000)}</expirationTime>\n` +
    `  </header>\n` +
    `  <service>${service}</service>\n` +
    `</loginTicketRequest>`;

  const cms = firmarTra(tra, cert, key);

  const envelope =
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:wsaa="http://wsaa.view.sua.dvadac.desein.afip.gov">` +
    `<soapenv:Header/><soapenv:Body><wsaa:loginCms><wsaa:in0>${cms}</wsaa:in0></wsaa:loginCms></soapenv:Body></soapenv:Envelope>`;

  const text = await soapPost(WSAA_URL, envelope, '""');
  const outer = parser.parse(text);
  const body = outer?.Envelope?.Body;
  if (body?.Fault) {
    throw new Error(`WSAA: ${body.Fault.faultstring ?? "fallo desconocido"}`);
  }
  const cmsReturn = body?.loginCmsResponse?.loginCmsReturn;
  if (!cmsReturn) throw new Error(`WSAA: respuesta inesperada — ${text.slice(0, 300)}`);

  const inner = parser.parse(cmsReturn);
  const cred = inner?.loginTicketResponse?.credentials;
  const header = inner?.loginTicketResponse?.header;
  if (!cred?.token || !cred?.sign) {
    throw new Error("WSAA: la respuesta no trae token/sign.");
  }
  return {
    token: String(cred.token),
    sign: String(cred.sign),
    expira: String(header?.expirationTime ?? ""),
  };
}

/**
 * Devuelve un ticket WSAA vigente para el servicio pedido (por defecto
 * "wsfe"), cacheado en `integraciones` (proveedor "afip"). Cada ticket dura
 * ~12hs; se renueva solo cuando falta poco para vencer.
 */
export async function obtenerTicketWsaa(
  service = "wsfe",
): Promise<{ token: string; sign: string; cuit: string }> {
  const { cuit } = credencialesAfip();

  const row = await db.query.integraciones.findFirst({
    where: eq(integraciones.proveedor, PROVEEDOR),
  });
  const datos = row?.datos ? safeParse(row.datos) : {};
  const cache = datos[service] as
    | { token: string; sign: string; expira: string }
    | undefined;

  const vencido =
    !cache || !cache.expira || new Date(cache.expira).getTime() - Date.now() < 5 * 60_000;

  if (!vencido && cache) {
    return { token: cache.token, sign: cache.sign, cuit };
  }

  const ticket = await loginWsaa(service);
  const nuevosDatos = { ...datos, [service]: ticket };
  await db
    .insert(integraciones)
    .values({
      proveedor: PROVEEDOR,
      storeId: cuit,
      estado: "conectado",
      datos: JSON.stringify(nuevosDatos),
    })
    .onConflictDoUpdate({
      target: integraciones.proveedor,
      set: { estado: "conectado", storeId: cuit, datos: JSON.stringify(nuevosDatos) },
    });

  return { token: ticket.token, sign: ticket.sign, cuit };
}

function safeParse(s: string): Record<string, unknown> {
  try {
    return JSON.parse(s);
  } catch {
    return {};
  }
}
