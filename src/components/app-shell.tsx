import Link from "next/link";

import { logout } from "@/app/(auth)/login/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Rol } from "@/lib/auth";

type NavItem = { href: string; label: string; ready?: boolean };

const NAV: { seccion: string; items: NavItem[] }[] = [
  {
    seccion: "Operación",
    items: [
      { href: "/", label: "Inicio", ready: true },
      { href: "/movimientos", label: "Movimientos" },
      { href: "/consignaciones", label: "Consignaciones" },
    ],
  },
  {
    seccion: "Registros",
    items: [
      { href: "/productos", label: "Productos", ready: true },
      { href: "/clientes", label: "Clientes" },
      { href: "/proveedores", label: "Proveedores" },
    ],
  },
  {
    seccion: "Finanzas",
    items: [
      { href: "/cc-clientes", label: "CC Clientes" },
      { href: "/cc-proveedores", label: "CC Proveedores" },
      { href: "/contabilidad", label: "Contabilidad" },
      { href: "/reportes", label: "Reportes" },
    ],
  },
  {
    seccion: "Configuración",
    items: [
      { href: "/config/rubros", label: "Rubros", ready: true },
      { href: "/config/usuarios", label: "Usuarios" },
    ],
  },
];

const ROL_LABEL: Record<Rol, string> = {
  admin: "Admin",
  ventas: "Ventas",
  lectura: "Solo lectura",
};

export function AppShell({
  nombre,
  email,
  rol,
  children,
}: {
  nombre: string;
  email: string;
  rol: Rol;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-full flex-col">
      <header className="flex h-14 items-center gap-3 border-b bg-primary px-4 text-primary-foreground">
        <span className="font-semibold">Maitén</span>
        <span className="hidden text-xs opacity-80 sm:inline">
          Sistema de gestión
        </span>
        <div className="ml-auto flex items-center gap-3 text-sm">
          <span className="hidden opacity-90 md:inline" title={email}>
            {nombre}
          </span>
          <Badge variant="secondary" className="hidden sm:inline-flex">
            {ROL_LABEL[rol]}
          </Badge>
          <form action={logout}>
            <Button type="submit" variant="secondary" size="sm" className="h-8">
              Salir
            </Button>
          </form>
        </div>
      </header>

      <div className="flex flex-1">
        <nav className="hidden w-56 shrink-0 border-r bg-sidebar p-3 md:block">
          {NAV.map((grupo) => (
            <div key={grupo.seccion} className="mb-4">
              <p className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                {grupo.seccion}
              </p>
              <ul className="space-y-0.5">
                {grupo.items.map((item) => (
                  <li key={item.href}>
                    {item.ready ? (
                      <Link
                        href={item.href}
                        className="block rounded-md px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground"
                      >
                        {item.label}
                      </Link>
                    ) : (
                      <span className="block cursor-not-allowed rounded-md px-2 py-1.5 text-sm text-muted-foreground/60">
                        {item.label}
                        <span className="ml-1 text-[10px]">pronto</span>
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        <main className="min-w-0 flex-1 p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
