import "server-only";

import PDFDocument from "pdfkit";
import QRCode from "qrcode";

import type { FacturaCompleta } from "../queries";

/** Datos fijos del emisor (Maitén Pets). No cambian; no hace falta env var. */
const EMISOR = {
  razonSocial: "MAITEN PETS",
  cuit: "30-71869690-5",
  domicilio: "Araoz 733 Piso:8 Dpto:A - Ciudad de Buenos Aires",
  condicionIva: "IVA Responsable Inscripto",
  ingresosBrutos: "30-71869690-5",
  inicioActividades: "01/10/2024",
};

const CONDICION_IVA_LABEL: Record<string, string> = {
  responsable_inscripto: "IVA Responsable Inscripto",
  monotributo: "Responsable Monotributo",
  exento: "IVA Sujeto Exento",
  consumidor_final: "Consumidor Final",
};

function fmtFechaCorta(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function fmtMoney(n: number): string {
  return n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

async function qrDataUrl(f: FacturaCompleta): Promise<string> {
  const payload = {
    ver: 1,
    fecha: f.fecha,
    cuit: 30718696905,
    ptoVta: f.puntoVenta,
    tipoCmp: f.codigoComprobante,
    nroCmp: f.numero,
    importe: f.importeTotal,
    moneda: "PES",
    ctz: 1,
    tipoDocRec: f.docTipo,
    nroDocRec: Number(f.docNro) || 0,
    tipoCodAut: "E",
    codAut: Number(f.cae),
  };
  const b64 = Buffer.from(JSON.stringify(payload)).toString("base64");
  const url = `https://www.afip.gob.ar/fe/qr/?p=${b64}`;
  return QRCode.toDataURL(url, { margin: 1, width: 200 });
}

/** Arma el PDF de una factura ya emitida (con CAE) en el formato AFIP. */
export async function pdfFactura(f: FacturaCompleta): Promise<Buffer> {
  const doc = new PDFDocument({ size: "A4", margin: 40 });
  const chunks: Buffer[] = [];
  doc.on("data", (c) => chunks.push(c));
  const done = new Promise<Buffer>((resolve) => doc.on("end", () => resolve(Buffer.concat(chunks))));

  const W = doc.page.width - 80; // ancho útil
  const letra = f.tipoComprobante;

  // ── Encabezado ──
  doc.font("Helvetica-Bold").fontSize(16).text(EMISOR.razonSocial, 40, 40);
  doc.font("Helvetica").fontSize(9).text(EMISOR.domicilio, 40, 60);
  doc.text(`Condición frente al IVA: ${EMISOR.condicionIva}`, 40, 74);

  const boxX = 380;
  doc.rect(boxX, 40, 175, 70).stroke();
  doc.font("Helvetica-Bold").fontSize(20).text(letra, boxX, 46, { width: 175, align: "center" });
  doc.font("Helvetica").fontSize(8).text(`COD. ${f.codigoComprobante.toString().padStart(2, "0")}`, boxX, 70, {
    width: 175,
    align: "center",
  });
  doc.font("Helvetica-Bold").fontSize(11).text("FACTURA", boxX, 88, { width: 175, align: "center" });

  doc.font("Helvetica").fontSize(9);
  doc.text(
    `Punto de Venta: ${String(f.puntoVenta).padStart(5, "0")}   Comp. N.º: ${String(f.numero).padStart(8, "0")}`,
    40,
    100,
  );
  doc.text(`Fecha de Emisión: ${fmtFechaCorta(f.fecha)}`, 40, 114);
  doc.text(`CUIT: ${EMISOR.cuit}`, 40, 128);
  doc.text(`Ingresos Brutos: ${EMISOR.ingresosBrutos}`, 40, 142);
  doc.text(`Inicio de Actividades: ${EMISOR.inicioActividades}`, 40, 156);

  doc.moveTo(40, 178).lineTo(40 + W, 178).stroke();

  // ── Receptor ──
  const docLabel = f.docTipo === 80 ? "CUIT" : f.docTipo === 96 ? "DNI" : "Documento";
  doc.font("Helvetica-Bold").fontSize(9).text("Datos del receptor", 40, 188);
  doc.font("Helvetica").fontSize(9);
  doc.text(`Apellido y Nombre / Razón Social: ${f.clienteNombre ?? "Consumidor Final"}`, 40, 202);
  doc.text(
    `${docLabel}: ${f.docTipo === 99 ? "—" : f.docNro}   ·   Condición frente al IVA: ${
      CONDICION_IVA_LABEL[f.clienteCondicionIva ?? "consumidor_final"]
    }`,
    40,
    216,
  );

  doc.moveTo(40, 236).lineTo(40 + W, 236).stroke();

  // ── Ítems ──
  let y = 248;
  doc.font("Helvetica-Bold").fontSize(8);
  doc.text("Código", 40, y, { width: 70 });
  doc.text("Producto / Servicio", 110, y, { width: 220 });
  doc.text("Cant.", 335, y, { width: 40, align: "right" });
  doc.text("Precio Unit.", 380, y, { width: 70, align: "right" });
  doc.text("Subtotal", 460, y, { width: 80, align: "right" });
  y += 14;
  doc.moveTo(40, y).lineTo(40 + W, y).stroke();
  y += 6;

  doc.font("Helvetica").fontSize(8);
  for (const it of f.items) {
    const subtotal = round2(it.cantidad * it.precioNeto);
    doc.text(it.sku, 40, y, { width: 70 });
    doc.text(it.producto, 110, y, { width: 220 });
    doc.text(String(it.cantidad), 335, y, { width: 40, align: "right" });
    doc.text(fmtMoney(it.precioNeto), 380, y, { width: 70, align: "right" });
    doc.text(fmtMoney(subtotal), 460, y, { width: 80, align: "right" });
    y += 16;
  }

  y += 10;
  doc.moveTo(320, y).lineTo(40 + W, y).stroke();
  y += 10;

  // ── Totales ──
  doc.font("Helvetica").fontSize(9);
  if (letra === "A") {
    doc.text("Importe Neto Gravado:", 320, y, { width: 140, align: "left" });
    doc.text(`$ ${fmtMoney(f.importeNeto)}`, 460, y, { width: 80, align: "right" });
    y += 14;
    doc.text("IVA 21%:", 320, y, { width: 140 });
    doc.text(`$ ${fmtMoney(f.importeIva)}`, 460, y, { width: 80, align: "right" });
    y += 14;
  } else {
    doc.text("Subtotal:", 320, y, { width: 140 });
    doc.text(`$ ${fmtMoney(f.importeNeto + f.importeIva)}`, 460, y, { width: 80, align: "right" });
    y += 14;
  }
  doc.font("Helvetica-Bold").fontSize(10);
  doc.text("Importe Total:", 320, y, { width: 140 });
  doc.text(`$ ${fmtMoney(f.importeTotal)}`, 460, y, { width: 80, align: "right" });
  y += 22;

  if (letra === "B") {
    doc.font("Helvetica").fontSize(7);
    doc.text("Régimen de Transparencia Fiscal al Consumidor (Ley 27.743)", 40, y);
    y += 10;
    doc.text(`IVA Contenido: $ ${fmtMoney(f.importeIva)}`, 40, y);
    y += 18;
  }

  // ── CAE + QR ──
  y = Math.max(y, doc.page.height - 140);
  doc.moveTo(40, y).lineTo(40 + W, y).stroke();
  y += 10;

  const qr = await qrDataUrl(f);
  doc.image(qr, 40, y, { width: 80 });

  doc.font("Helvetica-Bold").fontSize(9).text("Comprobante Autorizado", 140, y + 6);
  doc.font("Helvetica").fontSize(9);
  doc.text(`CAE N.º: ${f.cae}`, 140, y + 22);
  doc.text(`Fecha de Vto. de CAE: ${fmtFechaCorta(f.caeVencimiento)}`, 140, y + 36);

  doc.end();
  return done;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
