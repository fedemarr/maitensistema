export type EstadoConsignacion = "abierta" | "parcial" | "vencida" | "cerrada";

export const ESTADO_CONSIG_LABEL: Record<EstadoConsignacion, string> = {
  abierta: "Abierta",
  parcial: "Parcial",
  vencida: "Vencida",
  cerrada: "Cerrada",
};

export function estadoConsig(
  pendientes: number,
  vendidas: number,
  devueltas: number,
  vence: string,
): EstadoConsignacion {
  if (pendientes <= 0) return "cerrada";
  if (vence && vence < new Date().toISOString().slice(0, 10)) return "vencida";
  if (vendidas > 0 || devueltas > 0) return "parcial";
  return "abierta";
}

export type ConsignacionRow = {
  id: string;
  clienteId: string;
  cliente: string;
  productoId: string;
  producto: string;
  lote: string;
  fecha: string;
  vence: string;
  entregadas: number;
  vendidas: number;
  devueltas: number;
  pendientes: number;
  estado: EstadoConsignacion;
  ppp: number;
};
