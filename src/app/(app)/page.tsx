import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const PROXIMO = [
  "✅ Rubros — /config/rubros (crear + activar/desactivar)",
  "Módulo Clientes y Proveedores",
  "Módulo Movimientos (los 8 tipos)",
  "Ficha de producto con KPI de stock",
  "Reporte económico mensual",
];

export default function DashboardPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Inicio</h1>
        <p className="text-sm text-muted-foreground">
          Esqueleto funcionando. Login, sesión y protección de rutas están
          listos. Los módulos se van sumando desde acá.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Próximos pasos</CardTitle>
          <CardDescription>Orden de construcción (Fase 2).</CardDescription>
        </CardHeader>
        <CardContent>
          <ol className="list-decimal space-y-1.5 pl-5 text-sm">
            {PROXIMO.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}
