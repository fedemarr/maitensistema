import { HardHatIcon } from "lucide-react";

export function EnConstruccion({
  titulo,
  nota,
}: {
  titulo: string;
  nota?: string;
}) {
  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-semibold">{titulo}</h1>
      <div className="mt-6 flex items-start gap-3 rounded-lg border border-dashed bg-muted/30 p-5 text-sm text-muted-foreground">
        <HardHatIcon className="mt-0.5 size-5 shrink-0" />
        <div>
          <p className="font-medium text-foreground">En construcción</p>
          <p className="mt-1">
            {nota ??
              "Este módulo se está reconstruyendo según la especificación funcional (Fase 4)."}
          </p>
        </div>
      </div>
    </div>
  );
}
