export const ACCIONES = [
  "crear",
  "editar",
  "borrar",
  "login",
  "logout",
  "acceso_denegado",
] as const;
export type Accion = (typeof ACCIONES)[number];

export const ACCION_LABEL: Record<Accion, string> = {
  crear: "Alta",
  editar: "Modificación",
  borrar: "Baja",
  login: "Ingreso",
  logout: "Salida",
  acceso_denegado: "Acceso denegado",
};

/** Acciones sensibles que conviene resaltar en la vista. */
export const ACCIONES_SENSIBLES: Accion[] = ["borrar", "acceso_denegado"];

export const ENTIDAD_LABEL: Record<string, string> = {
  producto: "Producto",
  insumo: "Insumo",
  receta: "Receta",
  cliente: "Cliente",
  proveedor: "Proveedor",
  movimiento: "Movimiento",
  orden_produccion: "Orden de producción",
  compra_insumo: "Compra de insumos",
  baja_insumo: "Baja de insumo",
  cc_movimiento: "Cuenta corriente",
  costo_fijo: "Costo fijo",
  precio_venta: "Precio de venta",
  precio_fabricacion: "Precio de fabricación",
  minimo_compra_fabrica: "Mínimo de la fábrica",
  "plan-cuenta": "Cuenta contable",
  rubro: "Rubro",
  usuario: "Usuario",
  sesion: "Sesión",
  autorizacion: "Autorización",
  "verificacion-stock": "Verificación de stock",
};

export const entidadLabel = (e: string) => ENTIDAD_LABEL[e] ?? e;
