import { z } from "zod";

export const TIPOS_LISTA = ["retail", "mayorista"] as const;
export type TipoLista = (typeof TIPOS_LISTA)[number];

export const TIPO_LISTA_LABEL: Record<TipoLista, string> = {
  retail: "Retail",
  mayorista: "Mayorista",
};

/** IVA general (responsable inscripto). Los precios se cargan netos; el bruto es referencia. */
export const IVA = 1.21;

/**
 * Tipos de cliente que compran a la lista mayorista (D-04: "mayorista al
 * 40 %"). El resto usa retail. Es solo el precio sugerido: siempre editable
 * a mano en el movimiento.
 */
export const TIPOS_CLIENTE_MAYORISTA = ["distribuidor"] as const;

export const precioInput = z.object({
  productoId: z.uuid(),
  tipoLista: z.enum(TIPOS_LISTA),
  /** Precio SIN IVA. */
  precioNeto: z.coerce.number().min(0, "No puede ser negativo."),
  vigenteDesde: z.string().min(1, "La fecha es obligatoria."),
});
export type PrecioInput = z.infer<typeof precioInput>;
