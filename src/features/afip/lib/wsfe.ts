import "server-only";

import { XMLParser } from "fast-xml-parser";

import { soapPost } from "./soap";
import { obtenerTicketWsaa } from "./wsaa";

const WSFE_URL =
  process.env.AFIP_WSFE_URL ?? "https://servicios1.afip.gov.ar/wsfev1/service.asmx";

const parser = new XMLParser({ ignoreAttributes: false, removeNSPrefix: true });

/** Códigos de comprobante WSFE que usa el sistema. */
export const CBTE_TIPO = { facturaA: 1, facturaB: 6 } as const;
/** Alícuota de IVA general (Id AFIP 5 = 21%). */
export const ALIC_IVA_21 = 5;

async function callWsfe(method: string, innerXml: string): Promise<Record<string, unknown>> {
  const envelope =
    `<?xml version="1.0" encoding="utf-8"?>` +
    `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ar="http://ar.gov.afip.dif.FEV1/">` +
    `<soapenv:Header/><soapenv:Body><ar:${method}>${innerXml}</ar:${method}></soapenv:Body></soapenv:Envelope>`;

  const text = await soapPost(
    WSFE_URL,
    envelope,
    `http://ar.gov.afip.dif.FEV1/${method}`,
  );
  const outer = parser.parse(text);
  const body = outer?.Envelope?.Body;
  if (body?.Fault) {
    throw new Error(`WSFE ${method}: ${body.Fault.faultstring ?? "fallo desconocido"}`);
  }
  const resultado = body?.[`${method}Response`]?.[`${method}Result`];
  if (!resultado) throw new Error(`WSFE ${method}: respuesta inesperada — ${text.slice(0, 400)}`);
  return resultado;
}

function authXml(token: string, sign: string, cuit: string): string {
  return `<ar:Auth><ar:Token>${token}</ar:Token><ar:Sign>${sign}</ar:Sign><ar:Cuit>${cuit}</ar:Cuit></ar:Auth>`;
}

/** Chequeo de conectividad, sin autenticación. No emite nada. */
export async function feDummy(): Promise<{
  appServer: string;
  dbServer: string;
  authServer: string;
}> {
  const r = await callWsfe("FEDummy", "");
  return {
    appServer: String(r.AppServer ?? ""),
    dbServer: String(r.DbServer ?? ""),
    authServer: String(r.AuthServer ?? ""),
  };
}

/** Último número autorizado para un punto de venta + tipo de comprobante. */
export async function feCompUltimoAutorizado(
  puntoVenta: number,
  cbteTipo: number,
): Promise<number> {
  const { token, sign, cuit } = await obtenerTicketWsaa("wsfe");
  const inner =
    authXml(token, sign, cuit) +
    `<ar:PtoVta>${puntoVenta}</ar:PtoVta><ar:CbteTipo>${cbteTipo}</ar:CbteTipo>`;
  const r = await callWsfe("FECompUltimoAutorizado", inner);
  return Number(r.CbteNro ?? 0);
}

export type ItemFactura = {
  /** Tipo de doc del receptor: 80 = CUIT, 96 = DNI, 99 = sin identificar. */
  docTipo: number;
  docNro: string;
  /** 1 = Responsable Inscripto, 4 = Exento, 5 = Consumidor Final, 6 = Monotributo. */
  condicionIvaReceptorId: number;
  importeNeto: number;
  importeIva: number;
  importeTotal: number;
};

export type ResultadoCae = {
  ok: boolean;
  cae?: string;
  caeVencimiento?: string; // yyyy-mm-dd
  numero?: number;
  motivo?: string;
};

/** Pide un CAE para UN comprobante (concepto = productos). */
export async function feCaeSolicitar(
  puntoVenta: number,
  cbteTipo: number,
  numero: number,
  fecha: string, // yyyy-mm-dd
  item: ItemFactura,
): Promise<ResultadoCae> {
  const { token, sign, cuit } = await obtenerTicketWsaa("wsfe");
  const fch = fecha.replaceAll("-", "");
  const n2 = (x: number) => x.toFixed(2);

  const det =
    `<ar:FECAEDetRequest>` +
    `<ar:Concepto>1</ar:Concepto>` +
    `<ar:DocTipo>${item.docTipo}</ar:DocTipo>` +
    `<ar:DocNro>${item.docNro}</ar:DocNro>` +
    `<ar:CbteDesde>${numero}</ar:CbteDesde>` +
    `<ar:CbteHasta>${numero}</ar:CbteHasta>` +
    `<ar:CbteFch>${fch}</ar:CbteFch>` +
    `<ar:ImpTotal>${n2(item.importeTotal)}</ar:ImpTotal>` +
    `<ar:ImpTotConc>0.00</ar:ImpTotConc>` +
    `<ar:ImpNeto>${n2(item.importeNeto)}</ar:ImpNeto>` +
    `<ar:ImpOpEx>0.00</ar:ImpOpEx>` +
    `<ar:ImpIVA>${n2(item.importeIva)}</ar:ImpIVA>` +
    `<ar:ImpTrib>0.00</ar:ImpTrib>` +
    `<ar:MonId>PES</ar:MonId>` +
    `<ar:MonCotiz>1</ar:MonCotiz>` +
    `<ar:CondicionIVAReceptorId>${item.condicionIvaReceptorId}</ar:CondicionIVAReceptorId>` +
    `<ar:Iva><ar:AlicIva>` +
    `<ar:Id>${ALIC_IVA_21}</ar:Id>` +
    `<ar:BaseImp>${n2(item.importeNeto)}</ar:BaseImp>` +
    `<ar:Importe>${n2(item.importeIva)}</ar:Importe>` +
    `</ar:AlicIva></ar:Iva>` +
    `</ar:FECAEDetRequest>`;

  const inner =
    authXml(token, sign, cuit) +
    `<ar:FeCAEReq><ar:FeCabReq><ar:CantReg>1</ar:CantReg><ar:PtoVta>${puntoVenta}</ar:PtoVta>` +
    `<ar:CbteTipo>${cbteTipo}</ar:CbteTipo></ar:FeCabReq><ar:FeDetReq>${det}</ar:FeDetReq></ar:FeCAEReq>`;

  const r = await callWsfe("FECAESolicitar", inner);
  const cabResp = r.FeCabResp as Record<string, unknown> | undefined;
  const detResp = (r.FeDetResp as Record<string, unknown> | undefined)
    ?.FECAEDetResponse as Record<string, unknown> | undefined;

  const observaciones = juntarObservaciones(r, detResp);

  if (cabResp?.Resultado !== "A" || detResp?.Resultado !== "A") {
    return { ok: false, motivo: observaciones || "AFIP rechazó el comprobante." };
  }

  return {
    ok: true,
    cae: String(detResp.CAE ?? ""),
    caeVencimiento: formatFecha(String(detResp.CAEFchVto ?? "")),
    numero,
  };
}

function juntarObservaciones(
  r: Record<string, unknown>,
  detResp: Record<string, unknown> | undefined,
): string {
  const errores = extraerLista(r.Errors, "Err");
  const obsCab = extraerLista(r.Events, "Evt");
  const obsDet = detResp ? extraerLista(detResp.Observaciones, "Obs") : [];
  return [...errores, ...obsCab, ...obsDet].join(" | ");
}

function extraerLista(campo: unknown, clave: string): string[] {
  if (!campo || typeof campo !== "object") return [];
  const arr = (campo as Record<string, unknown>)[clave];
  const items = Array.isArray(arr) ? arr : arr ? [arr] : [];
  return items.map((it) => {
    const o = it as Record<string, unknown>;
    return `[${o.Code ?? ""}] ${o.Msg ?? ""}`.trim();
  });
}

/** "20260918" -> "2026-09-18" */
function formatFecha(yyyymmdd: string): string {
  if (yyyymmdd.length !== 8) return yyyymmdd;
  return `${yyyymmdd.slice(0, 4)}-${yyyymmdd.slice(4, 6)}-${yyyymmdd.slice(6, 8)}`;
}
